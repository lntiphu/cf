/**
 * MODALS.JS - Quản lý 5 Modals: Chi tiết, Thêm mới, Chỉnh sửa, Gallery, Xóa & Bảo mật
 */

let placeToDeleteId = null;
let pendingAction = null; // Lưu hành động chờ xác thực: { type: 'delete'|'update', data: ... }
let currentDetailPlaceId = null;
let currentGalleryIndex = 0;
let currentGalleryList = [];

        // Xử lý xem trước và tải ảnh cho quán
        function handleImagePreview(modalType) {
            const inputId = modalType === 'add' ? 'inputImage' : 'editImage';
            const wrapId = modalType === 'add' ? 'addImgPreviewWrap' : 'editImgPreviewWrap';
            const imgId = modalType === 'add' ? 'addImgPreview' : 'editImgPreview';
            const input = document.getElementById(inputId);
            const wrap = document.getElementById(wrapId);
            const img = document.getElementById(imgId);
            if (!input || !wrap || !img) return;

            const val = input.value.trim();
            if (val && !val.startsWith("Đang nén")) {
                img.src = val;
                img.onerror = () => { wrap.classList.add('hidden'); };
                img.onload = () => { wrap.classList.remove('hidden'); };
                wrap.classList.remove('hidden');
            } else {
                wrap.classList.add('hidden');
            }
        }

        function clearImage(modalType) {
            const inputId = modalType === 'add' ? 'inputImage' : 'editImage';
            const fileId = modalType === 'add' ? 'inputFileImage' : 'editFileImage';
            const input = document.getElementById(inputId);
            const fileInput = document.getElementById(fileId);
            if (input) input.value = '';
            if (fileInput) fileInput.value = '';
            handleImagePreview(modalType);
        }

        async function handleFileUpload(event, modalType) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            const inputId = modalType === 'add' ? 'inputImage' : 'editImage';
            const input = document.getElementById(inputId);

            if (input) input.value = "Đang nén và tải ảnh lên Supabase...";

            try {
                // 1. Nén ảnh tự động về kích thước chuẩn WebP siêu nhẹ (~50KB)
                const compressedBlob = await compressImage(file, 900, 0.82);

                // 2. Tạo tên file định danh duy nhất
                const fileName = `place_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;

                // 3. Tải lên Supabase Storage bucket 'places'
                const { data, error } = await supabaseClient
                    .storage
                    .from('places')
                    .upload(fileName, compressedBlob, {
                        contentType: 'image/webp',
                        upsert: true
                    });

                if (error) {
                    console.warn("Chưa cấu hình Supabase Storage bucket 'places' (hoặc thiếu quyền INSERT), chuyển sang lưu ảnh nén siêu nhẹ Base64:", error);
                    // Tự động fallback sang chuỗi Base64 đã được nén siêu nhẹ
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (input) input.value = e.target.result;
                        handleImagePreview(modalType);
                    };
                    reader.readAsDataURL(compressedBlob);
                    return;
                }

                // 4. Lấy link công khai (Public URL) từ Supabase Storage
                const { data: publicData } = supabaseClient
                    .storage
                    .from('places')
                    .getPublicUrl(fileName);

                if (input && publicData && publicData.publicUrl) {
                    input.value = publicData.publicUrl;
                    handleImagePreview(modalType);
                }
            } catch (err) {
                console.error("Lỗi khi xử lý ảnh:", err);
                alert("Không thể tải ảnh: " + err.message);
                if (input) input.value = "";
            }
        }


        // ================= QUẢN LÝ BỘ SƯU TẬP ẢNH (TỐI ĐA 5 ẢNH) =================
        const MAX_GALLERY_PHOTOS = 5;

        // --- 1. Quản lý ảnh trong modal Thêm quán mới ---
        let addGalleryImages = [];

        function renderAddGalleryGrid() {
            const grid = document.getElementById('addGalleryGrid');
            const counter = document.getElementById('addGalleryCounter');
            const btnAdd = document.getElementById('btnAddGallery');
            if (!grid) return;

            const count = addGalleryImages.length;
            if (counter) {
                counter.innerText = count >= MAX_GALLERY_PHOTOS ? `(${count}/${MAX_GALLERY_PHOTOS} - Đủ)` : `(${count}/${MAX_GALLERY_PHOTOS})`;
                counter.className = count >= MAX_GALLERY_PHOTOS ? 'text-xs font-bold text-red-600' : 'text-xs font-bold text-[#B57324]';
            }

            if (btnAdd) {
                if (count >= MAX_GALLERY_PHOTOS) {
                    btnAdd.classList.add('opacity-50', 'pointer-events-none');
                } else {
                    btnAdd.classList.remove('opacity-50', 'pointer-events-none');
                }
            }

            if (count === 0) {
                grid.innerHTML = '<p class="col-span-full text-center text-stone-400 text-xs py-3.5 italic bg-stone-50 rounded-xl border border-dashed border-stone-200">Chưa có ảnh nào (Tối đa 5 ảnh — Bạn có thể chọn 1 trong 5 ảnh làm ảnh chủ đề)</p>';
                return;
            }

            grid.innerHTML = addGalleryImages.map((url, idx) => {
                const isCover = (idx === 0);
                return `
                    <div ${isCover ? '' : `onclick="setAddCoverImage(${idx})"`}
                        class="relative group rounded-xl overflow-hidden bg-stone-100 aspect-square transition-all duration-200 ${isCover ? 'border-2 border-[#B57324] ring-2 ring-[#B57324]/30 shadow-md' : 'border border-stone-200 hover:border-[#B57324] shadow-sm hover:shadow-md cursor-pointer hover:scale-[1.01]'}"
                        title="${isCover ? 'Ảnh chủ đề hiện tại' : 'Bấm vào ảnh để chọn làm ảnh chủ đề'}">
                        <img src="${url}" alt="Ảnh ${idx + 1}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                        
                        ${isCover 
                            ? `<div class="absolute top-1.5 left-1.5 bg-[#B57324] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10">
                                 <i class="fa-solid fa-star text-amber-300 text-[9px]"></i>
                                 <span>Ảnh chủ đề</span>
                               </div>`
                            : `<button type="button" onclick="event.stopPropagation(); setAddCoverImage(${idx})"
                                 class="absolute top-1.5 left-1.5 bg-black/65 hover:bg-[#B57324] text-white text-[9px] font-semibold px-2 py-0.5 rounded-full shadow flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition z-10"
                                 title="Bấm để chọn làm ảnh chủ đề">
                                 <i class="fa-regular fa-star text-[9px]"></i>
                                 <span>Làm chủ đề</span>
                               </button>
                               <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition duration-200 flex items-center justify-center pointer-events-none">
                                 <span class="opacity-0 group-hover:opacity-100 bg-white/95 text-stone-800 text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm transition">Chọn làm chủ đề</span>
                               </div>`
                        }
                        
                        <button type="button" onclick="event.stopPropagation(); removeAddGalleryImage(${idx})"
                            class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center text-[10px] opacity-90 sm:opacity-0 group-hover:opacity-100 transition shadow z-10"
                            title="Xóa ảnh này">
                            <i class="fa-solid fa-xmark"></i>
                        </button>

                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-1.5 flex justify-between items-center text-white text-[9px] font-medium pointer-events-none">
                            <span class="bg-black/40 px-1.5 py-0.5 rounded">Ảnh ${idx + 1}</span>
                            <span class="text-white/90">${idx + 1}/${MAX_GALLERY_PHOTOS}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function setAddCoverImage(idx) {
            if (idx > 0 && idx < addGalleryImages.length) {
                const [selected] = addGalleryImages.splice(idx, 1);
                addGalleryImages.unshift(selected);
                renderAddGalleryGrid();
                if (typeof showToast === 'function') {
                    showToast('Đã chọn ảnh này làm ảnh chủ đề quán!', 'success');
                }
            }
        }

        function addGalleryImageToAddModal() {
            const urlInput = document.getElementById('addGalleryUrl');
            if (!urlInput) return;
            const url = urlInput.value.trim();
            if (!url) {
                alert('Vui lòng dán link ảnh hoặc chọn file ảnh từ máy!');
                return;
            }
            if (addGalleryImages.length >= MAX_GALLERY_PHOTOS) {
                alert(`Chỉ có thể thêm tối đa ${MAX_GALLERY_PHOTOS} ảnh! Vui lòng xóa bớt ảnh cũ trước.`);
                return;
            }
            addGalleryImages.push(url);
            urlInput.value = '';
            renderAddGalleryGrid();
        }

        function removeAddGalleryImage(idx) {
            if (idx >= 0 && idx < addGalleryImages.length) {
                addGalleryImages.splice(idx, 1);
                renderAddGalleryGrid();
            }
        }

        async function handleAddGalleryFileUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            if (addGalleryImages.length >= MAX_GALLERY_PHOTOS) {
                alert(`Chỉ có thể thêm tối đa ${MAX_GALLERY_PHOTOS} ảnh! Vui lòng xóa bớt ảnh cũ trước.`);
                event.target.value = '';
                return;
            }

            const urlInput = document.getElementById('addGalleryUrl');
            if (urlInput) urlInput.value = "Đang nén và tải ảnh lên...";

            try {
                const compressedBlob = await compressImage(file, 900, 0.82);
                const fileName = `gallery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;

                const { data, error } = await supabaseClient
                    .storage
                    .from('places')
                    .upload(fileName, compressedBlob, {
                        contentType: 'image/webp',
                        upsert: true
                    });

                if (error) {
                    console.warn("Supabase Storage fallback Base64:", error);
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (addGalleryImages.length < MAX_GALLERY_PHOTOS) {
                            addGalleryImages.push(e.target.result);
                            renderAddGalleryGrid();
                        }
                        if (urlInput) urlInput.value = '';
                    };
                    reader.readAsDataURL(compressedBlob);
                    return;
                }

                const { data: publicData } = supabaseClient
                    .storage
                    .from('places')
                    .getPublicUrl(fileName);

                if (publicData && publicData.publicUrl) {
                    if (addGalleryImages.length < MAX_GALLERY_PHOTOS) {
                        addGalleryImages.push(publicData.publicUrl);
                        renderAddGalleryGrid();
                    }
                }
                if (urlInput) urlInput.value = '';
            } catch (err) {
                console.error("Lỗi tải ảnh:", err);
                alert("Không thể tải ảnh: " + err.message);
                if (urlInput) urlInput.value = '';
            }
            event.target.value = '';
        }

        // --- 2. Quản lý ảnh trong modal Chỉnh sửa quán ---
        let editGalleryImages = []; // Mảng tạm giữ danh sách ảnh khi đang chỉnh sửa

        function renderEditGalleryGrid() {
            const grid = document.getElementById('editGalleryGrid');
            const counter = document.getElementById('editGalleryCounter');
            const btnEdit = document.getElementById('btnEditGallery');
            if (!grid) return;

            const count = editGalleryImages.length;
            if (counter) {
                counter.innerText = count >= MAX_GALLERY_PHOTOS ? `(${count}/${MAX_GALLERY_PHOTOS} - Đủ)` : `(${count}/${MAX_GALLERY_PHOTOS})`;
                counter.className = count >= MAX_GALLERY_PHOTOS ? 'text-xs font-bold text-red-600' : 'text-xs font-bold text-[#B57324]';
            }

            if (btnEdit) {
                if (count >= MAX_GALLERY_PHOTOS) {
                    btnEdit.classList.add('opacity-50', 'pointer-events-none');
                } else {
                    btnEdit.classList.remove('opacity-50', 'pointer-events-none');
                }
            }

            if (count === 0) {
                grid.innerHTML = '<p class="col-span-full text-center text-stone-400 text-xs py-3.5 italic bg-stone-50 rounded-xl border border-dashed border-stone-200">Chưa có ảnh nào (Tối đa 5 ảnh — Bạn có thể chọn 1 trong 5 ảnh làm ảnh chủ đề)</p>';
                return;
            }

            grid.innerHTML = editGalleryImages.map((url, idx) => {
                const isCover = (idx === 0);
                return `
                    <div ${isCover ? '' : `onclick="setEditCoverImage(${idx})"`}
                        class="relative group rounded-xl overflow-hidden bg-stone-100 aspect-square transition-all duration-200 ${isCover ? 'border-2 border-[#B57324] ring-2 ring-[#B57324]/30 shadow-md' : 'border border-stone-200 hover:border-[#B57324] shadow-sm hover:shadow-md cursor-pointer hover:scale-[1.01]'}"
                        title="${isCover ? 'Ảnh chủ đề hiện tại' : 'Bấm vào ảnh để chọn làm ảnh chủ đề'}">
                        <img src="${url}" alt="Ảnh ${idx + 1}" class="w-full h-full object-cover" onerror="this.style.display='none'">
                        
                        ${isCover 
                            ? `<div class="absolute top-1.5 left-1.5 bg-[#B57324] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10">
                                 <i class="fa-solid fa-star text-amber-300 text-[9px]"></i>
                                 <span>Ảnh chủ đề</span>
                               </div>`
                            : `<button type="button" onclick="event.stopPropagation(); setEditCoverImage(${idx})"
                                 class="absolute top-1.5 left-1.5 bg-black/65 hover:bg-[#B57324] text-white text-[9px] font-semibold px-2 py-0.5 rounded-full shadow flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition z-10"
                                 title="Bấm để chọn làm ảnh chủ đề">
                                 <i class="fa-regular fa-star text-[9px]"></i>
                                 <span>Làm chủ đề</span>
                               </button>
                               <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition duration-200 flex items-center justify-center pointer-events-none">
                                 <span class="opacity-0 group-hover:opacity-100 bg-white/95 text-stone-800 text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm transition">Chọn làm chủ đề</span>
                               </div>`
                        }
                        
                        <button type="button" onclick="event.stopPropagation(); removeGalleryImage(${idx})"
                            class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center text-[10px] opacity-90 sm:opacity-0 group-hover:opacity-100 transition shadow z-10"
                            title="Xóa ảnh này">
                            <i class="fa-solid fa-xmark"></i>
                        </button>

                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-1.5 flex justify-between items-center text-white text-[9px] font-medium pointer-events-none">
                            <span class="bg-black/40 px-1.5 py-0.5 rounded">Ảnh ${idx + 1}</span>
                            <span class="text-white/90">${idx + 1}/${MAX_GALLERY_PHOTOS}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function setEditCoverImage(idx) {
            if (idx > 0 && idx < editGalleryImages.length) {
                const [selected] = editGalleryImages.splice(idx, 1);
                editGalleryImages.unshift(selected);
                renderEditGalleryGrid();
                if (typeof showToast === 'function') {
                    showToast('Đã chọn ảnh này làm ảnh chủ đề quán!', 'success');
                }
            }
        }

        function addGalleryImage() {
            const urlInput = document.getElementById('editGalleryUrl');
            if (!urlInput) return;

            const url = urlInput.value.trim();
            if (!url) {
                alert('Vui lòng nhập link ảnh hoặc tải ảnh lên trước!');
                return;
            }

            if (editGalleryImages.length >= MAX_GALLERY_PHOTOS) {
                alert(`Chỉ có thể thêm tối đa ${MAX_GALLERY_PHOTOS} ảnh! Vui lòng xóa bớt ảnh cũ trước.`);
                return;
            }

            editGalleryImages.push(url);
            urlInput.value = '';
            renderEditGalleryGrid();
        }

        function removeGalleryImage(idx) {
            if (idx >= 0 && idx < editGalleryImages.length) {
                editGalleryImages.splice(idx, 1);
                renderEditGalleryGrid();
            }
        }

        async function handleGalleryFileUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            if (editGalleryImages.length >= MAX_GALLERY_PHOTOS) {
                alert(`Chỉ có thể thêm tối đa ${MAX_GALLERY_PHOTOS} ảnh! Vui lòng xóa bớt ảnh cũ trước.`);
                event.target.value = '';
                return;
            }

            const urlInput = document.getElementById('editGalleryUrl');
            if (urlInput) urlInput.value = "Đang nén và tải ảnh lên...";

            try {
                const compressedBlob = await compressImage(file, 900, 0.82);
                const fileName = `gallery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;

                const { data, error } = await supabaseClient
                    .storage
                    .from('places')
                    .upload(fileName, compressedBlob, {
                        contentType: 'image/webp',
                        upsert: true
                    });

                if (error) {
                    console.warn("Supabase Storage lỗi, chuyển sang Base64:", error);
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (editGalleryImages.length < MAX_GALLERY_PHOTOS) {
                            editGalleryImages.push(e.target.result);
                            renderEditGalleryGrid();
                        }
                        if (urlInput) urlInput.value = '';
                    };
                    reader.readAsDataURL(compressedBlob);
                    return;
                }

                const { data: publicData } = supabaseClient
                    .storage
                    .from('places')
                    .getPublicUrl(fileName);

                if (publicData && publicData.publicUrl) {
                    if (editGalleryImages.length < MAX_GALLERY_PHOTOS) {
                        editGalleryImages.push(publicData.publicUrl);
                        renderEditGalleryGrid();
                    }
                }
                if (urlInput) urlInput.value = '';
            } catch (err) {
                console.error("Lỗi tải ảnh gallery:", err);
                alert("Không thể tải ảnh: " + err.message);
                if (urlInput) urlInput.value = '';
            }

            // Reset file input
            event.target.value = '';
        }
        // ================= KẾT THÚC GALLERY =================


        function openDirections(placeId) {
            const place = places.find(p => String(p.id) === String(placeId));
            if (!place) return;

            const mapUrl = getPlaceMapUrl(place);
            window.open(mapUrl, '_blank', 'noopener,noreferrer');
        }


        // Bộ ảnh cà phê chất lượng cao dùng làm fallback khi quán chưa có ảnh
        const CAFE_AESTHETIC_PHOTOS = [
            'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1507133750040-4a8f570215b8?auto=format&fit=crop&w=800&q=80'
        ];

        let currentDetailPhotos = [];

        // Hiển thị bố cục 5 ảnh chuẩn theo hình mẫu Cafe Maps (1 ảnh lớn 50% bên trái, 4 ảnh nhỏ 2x2 50% bên phải)
        function renderDetailPhotoGrid(photos, placeName) {
            const gridEl = document.getElementById('detailPhotoGrid');
            const viewAllTextEl = document.getElementById('detailViewAllPhotosText');
            if (!gridEl) return;

            const count = photos.length;
            if (viewAllTextEl) {
                viewAllTextEl.innerText = count === 1 ? 'Xem ảnh đầy đủ' : `Xem tất cả ${count} ảnh`;
            }

            const extraCount = count > 5 ? (count - 5) : 0;

            gridEl.className = "grid grid-cols-2 gap-2 sm:gap-2.5 h-80 sm:h-[480px] md:h-[530px] rounded-2xl overflow-hidden";
            gridEl.innerHTML = `
                <!-- Ảnh chính bên trái (chiếm 50% chiều rộng) -->
                <div class="relative h-full w-full min-h-0 min-w-0 overflow-hidden cursor-pointer group bg-stone-100" onclick="openPhotoLightbox(0)">
                    <img src="${photos[0]}" alt="${placeName} 1" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                </div>
                <!-- 4 ảnh nhỏ bên phải (chiếm 50% chiều rộng, lưới 2 cột x 2 hàng KÍCH THƯỚC BẰNG NHAU TUYỆT ĐỐI 100%) -->
                <div class="grid grid-cols-2 gap-2 sm:gap-2.5 h-full min-h-0" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr));">
                    <div class="relative h-full w-full min-h-0 min-w-0 overflow-hidden cursor-pointer group bg-stone-100" onclick="openPhotoLightbox(1)">
                        <img src="${photos[1] || photos[0]}" alt="${placeName} 2" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    </div>
                    <div class="relative h-full w-full min-h-0 min-w-0 overflow-hidden cursor-pointer group bg-stone-100" onclick="openPhotoLightbox(2)">
                        <img src="${photos[2] || photos[0]}" alt="${placeName} 3" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    </div>
                    <div class="relative h-full w-full min-h-0 min-w-0 overflow-hidden cursor-pointer group bg-stone-100" onclick="openPhotoLightbox(3)">
                        <img src="${photos[3] || photos[0]}" alt="${placeName} 4" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    </div>
                    <div class="relative h-full w-full min-h-0 min-w-0 overflow-hidden cursor-pointer group bg-stone-100" onclick="openPhotoLightbox(4)">
                        <img src="${photos[4] || photos[0]}" alt="${placeName} 5" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        ${extraCount > 0 ? `
                            <div class="absolute inset-0 bg-black/45 group-hover:bg-black/55 flex items-center justify-center transition">
                                <span class="text-white font-bold text-xs sm:text-base tracking-wide drop-shadow-md">+${extraCount} ảnh</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Mở Modal Chi Tiết Quán chuẩn Cafe Maps 1:1
        function openDetailModal(id) {
            const place = places.find(p => String(p.id) === String(id));
            if (!place) return;
            currentDetailPlaceId = String(id);

            const idNum = Math.abs(Number(place.id)) || 1;

            // 1. Phân tích Gallery ảnh (chỉ lấy ảnh thật của quán, loại bỏ hoàn toàn ảnh trùng lặp)
            let rawGallery = [];
            try {
                const raw = place.gallery_images;
                rawGallery = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);
                if (!Array.isArray(rawGallery)) rawGallery = [];
            } catch (e) { rawGallery = []; }

            const coverCandidate = (place.image && place.image.trim() && !place.image.startsWith('data:image/svg')) ? place.image.trim() :
                                  (place.image_url && place.image_url.trim() && !place.image_url.startsWith('data:image/svg')) ? place.image_url.trim() : '';

            // Lọc ra danh sách ảnh ĐỘC NHẤT (không bao giờ trùng lặp cùng 1 ảnh)
            let uniquePhotos = [];
            if (coverCandidate) uniquePhotos.push(coverCandidate);
            rawGallery.forEach(img => {
                const url = (typeof img === 'string') ? img.trim() : '';
                if (url && !url.startsWith('data:image/svg') && !uniquePhotos.includes(url)) {
                    uniquePhotos.push(url);
                }
            });

            // Luôn bổ sung đủ 5 ảnh thẩm mỹ để bố cục 5 ảnh luôn chuẩn đẹp như thiết kế
            let displayPhotos = [...uniquePhotos];
            let seedIdx = 0;
            while (displayPhotos.length < 5) {
                const fallbackImg = CAFE_AESTHETIC_PHOTOS[(idNum * 3 + seedIdx) % CAFE_AESTHETIC_PHOTOS.length];
                if (!displayPhotos.includes(fallbackImg)) {
                    displayPhotos.push(fallbackImg);
                }
                seedIdx++;
                if (seedIdx > 25) break;
            }

            currentDetailPhotos = [...displayPhotos];

            // Render bố cục 5 ảnh chuẩn như hình mẫu Cafe Maps
            renderDetailPhotoGrid(currentDetailPhotos, place.name);

            // 2. Tên & Đánh giá (Chuẩn Cafe Maps)
            const nameEl = document.getElementById('detailName');
            if (nameEl) nameEl.innerText = place.name;

            const ratingEl = document.getElementById('detailRating');
            if (ratingEl) ratingEl.innerText = `${Number(place.rating || 5).toFixed(1)}`;

            const addrEl = document.getElementById('detailAddress');
            if (addrEl) {
                let displayAddr = (place.address || '').trim();
                const dist = (place.district || '').trim();
                if (dist && (!displayAddr || !displayAddr.toLowerCase().includes(dist.toLowerCase()))) {
                    displayAddr = displayAddr ? `${displayAddr}, ${dist}` : dist;
                }
                addrEl.innerText = displayAddr || 'TP. Hồ Chí Minh';
            }

            const priceEl = document.getElementById('detailPrice');
            if (priceEl) priceEl.innerText = place.price || getPlacePrice(place);

            // 3. Trạng thái mở cửa
            const openStatus = isOpenNow(place.opening_hours);
            const openTextEl = document.getElementById('detailOpenText');
            const openStatusEl = document.getElementById('detailOpenStatus');
            const openDotEl = document.getElementById('detailOpenDot');
            if (openStatusEl && openTextEl) {
                if (openStatus === true) {
                    openStatusEl.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF5EE] text-[#2E7D32] font-semibold border border-[#C8E6C9]";
                    openTextEl.innerText = `Đang mở • ${place.opening_hours || '08:00 – 22:00'}`;
                    if (openDotEl) {
                        openDotEl.innerHTML = `<span class="status-dot-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>`;
                    }
                } else if (openStatus === false) {
                    openStatusEl.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 font-semibold border border-rose-200/80";
                    openTextEl.innerText = `Đóng cửa • ${place.opening_hours || ''}`;
                    if (openDotEl) {
                        openDotEl.innerHTML = `<span class="status-dot-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>`;
                    }
                } else {
                    openStatusEl.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-600 font-semibold border border-stone-200";
                    openTextEl.innerText = place.opening_hours ? `${place.opening_hours}` : 'Mở cửa hàng ngày';
                    if (openDotEl) {
                        openDotEl.innerHTML = `<span class="relative inline-flex rounded-full h-2 w-2 bg-stone-400"></span>`;
                    }
                }
            }

            // 4. VIBE CHÍNH, PHÙ HỢP, KHÔNG GIAN (Chuẩn 1:1 theo Cafe Maps)
            const tags = getPlaceTags(place);
            const vibeWrap = document.getElementById('detailVibeTags');
            const purposeWrap = document.getElementById('detailPurposeTags');
            const spaceWrap = document.getElementById('detailSpaceTags');

            // Hàm chuẩn hóa viết hoa chữ cái đầu cho tag
            function formatTagLabel(str) {
                if (!str) return '';
                const s = String(str).trim();
                if (!s) return '';
                return s.charAt(0).toUpperCase() + s.slice(1);
            }

            // Trình phân giải icon & màu sắc cao cấp cho thẻ VIBE CHÍNH
            function getVibeTagConfig(rawText, index) {
                const t = normalizeSearchText(rawText);
                if (t.includes('minimalist') || t.includes('toi gian') || t.includes('tinh te')) {
                    return { icon: 'fa-solid fa-wand-magic-sparkles', iconColor: 'text-purple-600', pillCls: 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]' };
                }
                if (t.includes('vintage') || t.includes('co dien') || t.includes('retro')) {
                    return { icon: 'fa-solid fa-camera-retro', iconColor: 'text-[#B57324]', pillCls: 'bg-[#FAF0E6] text-[#8C5228] border-[#E8DFD5]' };
                }
                if (t.includes('chill') || t.includes('yen tinh') || t.includes('nhe nhang') || t.includes('binh yen')) {
                    return { icon: 'fa-solid fa-feather', iconColor: 'text-amber-600', pillCls: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]' };
                }
                if (t.includes('lang man') || t.includes('tho mong') || t.includes('sweet')) {
                    return { icon: 'fa-solid fa-heart', iconColor: 'text-rose-500', pillCls: 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]' };
                }
                if (t.includes('song ao') || t.includes('chup anh') || t.includes('photo') || t.includes('art') || t.includes('nghe thuat')) {
                    return { icon: 'fa-solid fa-camera', iconColor: 'text-pink-500', pillCls: 'bg-[#FDF2F8] text-[#BE185D] border-[#FBCFE8]' };
                }
                if (t.includes('hien dai') || t.includes('sang trong') || t.includes('luxury')) {
                    return { icon: 'fa-solid fa-gem', iconColor: 'text-indigo-600', pillCls: 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]' };
                }
                if (t.includes('am cung') || t.includes('go') || t.includes('moc mac')) {
                    return { icon: 'fa-solid fa-mug-hot', iconColor: 'text-[#8C5228]', pillCls: 'bg-[#FAF4EE] text-[#7C4A21] border-[#EADCCE]' };
                }
                if (t.includes('soi dong') || t.includes('nhon nhip') || t.includes('tre trung')) {
                    return { icon: 'fa-solid fa-fire-flame-curved', iconColor: 'text-orange-500', pillCls: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]' };
                }
                const fallbacks = [
                    { icon: 'fa-solid fa-wand-magic-sparkles', iconColor: 'text-[#B57324]', pillCls: 'bg-[#FAF0E6] text-[#8C5228] border-[#E8DFD5]' },
                    { icon: 'fa-solid fa-star', iconColor: 'text-amber-500', pillCls: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]' },
                    { icon: 'fa-solid fa-heart', iconColor: 'text-rose-500', pillCls: 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]' }
                ];
                return fallbacks[index % fallbacks.length];
            }

            // Trình phân giải icon & màu sắc cao cấp cho thẻ PHÙ HỢP (Purpose)
            function getPurposeTagConfig(rawText, index) {
                const t = normalizeSearchText(rawText);
                if (t.includes('hen ho') || t.includes('cap doi') || t.includes('tinh nhan') || t.includes('date')) {
                    return { icon: 'fa-solid fa-heart', iconColor: 'text-rose-500', pillCls: 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]' };
                }
                if (t.includes('lam viec') || t.includes('hoc tap') || t.includes('remote') || t.includes('laptop') || t.includes('deadline')) {
                    return { icon: 'fa-solid fa-laptop', iconColor: 'text-blue-600', pillCls: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' };
                }
                if (t.includes('gap ban') || t.includes('ban be') || t.includes('hop nhom') || t.includes('tu tap') || t.includes('tro chuyen')) {
                    return { icon: 'fa-solid fa-user-group', iconColor: 'text-purple-600', pillCls: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]' };
                }
                if (t.includes('chup anh') || t.includes('song ao') || t.includes('checkin') || t.includes('ootd')) {
                    return { icon: 'fa-solid fa-camera', iconColor: 'text-pink-500', pillCls: 'bg-[#FDF2F8] text-[#BE185D] border-[#FBCFE8]' };
                }
                if (t.includes('doc sach') || t.includes('chill mot minh') || t.includes('mot minh')) {
                    return { icon: 'fa-solid fa-book-open', iconColor: 'text-amber-600', pillCls: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]' };
                }
                if (t.includes('gia dinh') || t.includes('nguoi lon') || t.includes('tre em')) {
                    return { icon: 'fa-solid fa-house-chimney-user', iconColor: 'text-teal-600', pillCls: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]' };
                }
                if (t.includes('an uong') || t.includes('an sang') || t.includes('an trua') || t.includes('nhau')) {
                    return { icon: 'fa-solid fa-utensils', iconColor: 'text-orange-500', pillCls: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]' };
                }
                const fallbacks = [
                    { icon: 'fa-solid fa-heart', iconColor: 'text-rose-500', pillCls: 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]' },
                    { icon: 'fa-solid fa-laptop', iconColor: 'text-blue-600', pillCls: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' },
                    { icon: 'fa-solid fa-user-group', iconColor: 'text-purple-600', pillCls: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]' }
                ];
                return fallbacks[index % fallbacks.length];
            }

            // Trình phân giải icon & màu sắc cao cấp cho thẻ KHÔNG GIAN (Space)
            function getSpaceTagConfig(rawText, index) {
                const t = normalizeSearchText(rawText);
                if (t.includes('ngoai troi') || t.includes('outdoor')) {
                    return { icon: 'fa-solid fa-tree', iconColor: 'text-emerald-600', pillCls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' };
                }
                if (t.includes('trong nha') || t.includes('indoor')) {
                    return { icon: 'fa-solid fa-couch', iconColor: 'text-amber-700', pillCls: 'bg-[#FEFCE8] text-[#854D0E] border-[#FEF08A]' };
                }
                if (t.includes('san vuon') || t.includes('cay xanh') || t.includes('vuon')) {
                    return { icon: 'fa-solid fa-leaf', iconColor: 'text-emerald-500', pillCls: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' };
                }
                if (t.includes('view') || t.includes('canh quan') || t.includes('song') || t.includes('ho')) {
                    return { icon: 'fa-solid fa-mountain-sun', iconColor: 'text-sky-600', pillCls: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]' };
                }
                if (t.includes('rooftop') || t.includes('tang thuong') || t.includes('ban cong')) {
                    return { icon: 'fa-solid fa-cloud-sun', iconColor: 'text-fuchsia-600', pillCls: 'bg-[#FDF4FF] text-[#86198F] border-[#F5D0FE]' };
                }
                if (t.includes('rong rai') || t.includes('thoang') || t.includes('lon')) {
                    return { icon: 'fa-solid fa-maximize', iconColor: 'text-teal-600', pillCls: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]' };
                }
                if (t.includes('may lanh') || t.includes('dieu hoa')) {
                    return { icon: 'fa-solid fa-snowflake', iconColor: 'text-cyan-600', pillCls: 'bg-[#ECFEFF] text-[#0E7490] border-[#A5F3FC]' };
                }
                const fallbacks = [
                    { icon: 'fa-solid fa-tree', iconColor: 'text-emerald-600', pillCls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
                    { icon: 'fa-solid fa-couch', iconColor: 'text-amber-700', pillCls: 'bg-[#FEFCE8] text-[#854D0E] border-[#FEF08A]' },
                    { icon: 'fa-solid fa-mountain-sun', iconColor: 'text-sky-600', pillCls: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]' }
                ];
                return fallbacks[index % fallbacks.length];
            }

            // Trình phân giải icon & màu sắc cao cấp cho thẻ TIỆN ÍCH (Amenities)
            function getAmenityTagConfig(rawText, index) {
                const t = normalizeSearchText(rawText);
                if (t.includes('wifi') || t.includes('internet') || t.includes('mang')) {
                    return { icon: 'fa-solid fa-wifi', iconColor: 'text-sky-500', pillCls: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]' };
                }
                if (t.includes('dieu hoa') || t.includes('may lanh') || t.includes('lanh')) {
                    return { icon: 'fa-solid fa-snowflake', iconColor: 'text-cyan-500', pillCls: 'bg-[#ECFEFF] text-[#0E7490] border-[#A5F3FC]' };
                }
                if (t.includes('o dien') || t.includes('cam sac') || t.includes('sac')) {
                    return { icon: 'fa-solid fa-plug', iconColor: 'text-amber-500', pillCls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' };
                }
                if (t.includes('gui xe') || t.includes('giu xe') || t.includes('do xe') || t.includes('xe may') || t.includes('oto')) {
                    return { icon: 'fa-solid fa-motorcycle', iconColor: 'text-emerald-600', pillCls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' };
                }
                if (t.includes('the') || t.includes('card') || t.includes('chuyen khoan') || t.includes('momo') || t.includes('thanh toan')) {
                    return { icon: 'fa-solid fa-credit-card', iconColor: 'text-purple-500', pillCls: 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]' };
                }
                if (t.includes('thu cung') || t.includes('pet') || t.includes('cho') || t.includes('meo')) {
                    return { icon: 'fa-solid fa-paw', iconColor: 'text-orange-500', pillCls: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]' };
                }
                if (t.includes('hut thuoc') || t.includes('thuoc la')) {
                    return { icon: 'fa-solid fa-smoking', iconColor: 'text-stone-500', pillCls: 'bg-stone-100 text-stone-700 border-stone-200' };
                }
                if (t.includes('24/7') || t.includes('xuyen dem') || t.includes('dem')) {
                    return { icon: 'fa-solid fa-moon', iconColor: 'text-indigo-500', pillCls: 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]' };
                }
                return { icon: 'fa-solid fa-circle-check', iconColor: 'text-emerald-500', pillCls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' };
            }

            // VIBE CHÍNH: vd vintage, lãng mạn, yên tĩnh, chill
            if (vibeWrap) {
                const vibes = getPlaceVibes(place);
                vibeWrap.innerHTML = vibes.map((v, i) => {
                    const cfg = getVibeTagConfig(v, i);
                    return `
                        <span class="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full ${cfg.pillCls} border shadow-2xs font-semibold text-xs transition-all hover:scale-105 duration-150">
                            <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] ${cfg.iconColor} shadow-2xs flex-shrink-0">
                                <i class="${cfg.icon}"></i>
                            </span>
                            <span class="leading-none pt-0.5">${formatTagLabel(v)}</span>
                        </span>
                    `;
                }).join('');
            }

            // PHÙ HỢP: dữ liệu riêng, vd hẹn hò, làm việc remote, chụp ảnh
            if (purposeWrap) {
                let purposes = [];
                // Chỉ dùng giá trị mặc định khi purpose là undefined hoặc null
                if (place.purpose !== undefined && place.purpose !== null) {
                    const rawPurpose = String(place.purpose).trim();
                    if (rawPurpose) {
                        purposes = rawPurpose.split(',').map(p => p.trim()).filter(Boolean);
                    }
                } else {
                    purposes = ['hẹn hò', 'làm việc'];
                }
                
                purposeWrap.innerHTML = purposes.map((p, i) => {
                    const cfg = getPurposeTagConfig(p, i);
                    return `
                        <span class="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full ${cfg.pillCls} border shadow-2xs font-semibold text-xs transition-all hover:scale-105 duration-150">
                            <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] ${cfg.iconColor} shadow-2xs flex-shrink-0">
                                <i class="${cfg.icon}"></i>
                            </span>
                            <span class="leading-none pt-0.5">${formatTagLabel(p)}</span>
                        </span>
                    `;
                }).join('');
            }

            // KHÔNG GIAN: lấy trực tiếp từ trường "Không gian" (lưu trong ideal_for để tương thích dữ liệu cũ)
            if (spaceWrap) {
                let spaces = [];
                // Chỉ dùng giá trị mặc định khi ideal_for là undefined hoặc null, KHÔNG dùng khi là chuỗi rỗng
                if (place.ideal_for !== undefined && place.ideal_for !== null) {
                    const rawSpace = String(place.ideal_for).trim();
                    if (rawSpace) {
                        spaces = rawSpace.split(',')
                            .map(s => s.trim())
                            .filter(Boolean);
                    }
                } else {
                    spaces = ['ngoài trời', 'trong nhà'];
                }
                
                spaceWrap.innerHTML = spaces.map((s, i) => {
                    const cfg = getSpaceTagConfig(s, i);
                    return `
                        <span class="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full ${cfg.pillCls} border shadow-2xs font-semibold text-xs transition-all hover:scale-105 duration-150">
                            <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] ${cfg.iconColor} shadow-2xs flex-shrink-0">
                                <i class="${cfg.icon}"></i>
                            </span>
                            <span class="leading-none pt-0.5">${formatTagLabel(s)}</span>
                        </span>
                    `;
                }).join('');
            }

            // TIỆN ÍCH: wifi mạnh, máy lạnh, ổ cắm điện, thanh toán thẻ...
            const amenitiesWrap = document.getElementById('detailAmenitiesTags');
            if (amenitiesWrap) {
                let rawAmenities = [];
                // Chỉ dùng giá trị mặc định khi amenities là undefined hoặc null
                if (place.amenities !== undefined && place.amenities !== null) {
                    const amenitiesStr = String(place.amenities).trim();
                    if (amenitiesStr) {
                        rawAmenities = amenitiesStr.split(',').map(a => a.trim()).filter(Boolean);
                    }
                } else {
                    rawAmenities = ['wifi tốc độ cao', 'máy lạnh', 'thanh toán thẻ'];
                }
                
                amenitiesWrap.innerHTML = rawAmenities.map((a, i) => {
                    const cfg = getAmenityTagConfig(a, i);
                    return `
                        <span class="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full ${cfg.pillCls} border shadow-2xs font-semibold text-xs transition-all hover:scale-105 duration-150">
                            <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] ${cfg.iconColor} shadow-2xs flex-shrink-0">
                                <i class="${cfg.icon}"></i>
                            </span>
                            <span class="leading-none pt-0.5">${formatTagLabel(a)}</span>
                        </span>
                    `;
                }).join('');
            }

            // 5. Trích dẫn nhận xét / Ghi chú (chỉ hiển thị khi quán có ghi chú/nhận xét)
            const reviewWrap = document.getElementById('detailReviewWrap');
            const reviewText = document.getElementById('detailReviewText');
            if (reviewWrap && reviewText) {
                const cleanedReview = cleanTextField(place.review);
                if (cleanedReview) {
                    reviewText.innerText = `“${cleanedReview}”`;
                    reviewWrap.classList.remove('hidden');
                } else {
                    reviewWrap.classList.add('hidden');
                }
            }

            // 6. Chỗ để xe (Parking)
            const parkingTextEl = document.getElementById('detailParkingText');
            if (parkingTextEl) {
                // Chỉ dùng giá trị mặc định khi parking là undefined hoặc null
                const parkingText = (place.parking !== undefined && place.parking !== null) 
                    ? place.parking 
                    : 'Gửi xe trước quán (miễn phí)';
                parkingTextEl.innerHTML = parkingText;
            }

            // 7. Thức uống đặc trưng
            const drinkEl = document.getElementById('detailSignatureDrink');
            if (drinkEl) {
                const drinks = ['Trà đào cam sả', 'Cà phê Muối béo ngậy', 'Trà Ô Long sữa nướng', 'Matcha Latte nguyên chất', 'Cold Brew cam vàng'];
                drinkEl.innerText = place.signature_drink || drinks[(idNum % drinks.length)] || 'Trà Ô Long sữa nướng';
            }

            // 8. Trang thông tin / Mạng xã hội quán (Instagram, Facebook, TikTok, Website...)
            const igLinkEl = document.getElementById('detailInstagramLink');
            const igHandleEl = document.getElementById('detailInstagramHandle');
            const socialTitleEl = document.getElementById('detailSocialTitle');
            const socialIconEl = document.getElementById('detailSocialIcon');
            if (igLinkEl && igHandleEl) {
                const info = parsePlaceSocialLink(place.instagram, place.name);
                igHandleEl.innerText = info.displayText;
                igLinkEl.href = info.url;
                if (socialTitleEl) socialTitleEl.innerText = info.title;
                if (socialIconEl) socialIconEl.className = info.iconClass;
                igLinkEl.title = `Mở ${info.displayText} (${info.title})`;
            }

            // 9. Cập nhật trạng thái các nút ở thanh đáy và liên kết bản đồ cafemaps.net
            updateDetailActionButtons();
            const btnDirections = document.getElementById('btnDetailDirections');
            if (btnDirections) {
                const mapUrl = getPlaceMapUrl(place);
                btnDirections.dataset.mapUrl = mapUrl;
                if (btnDirections.tagName === 'A') {
                    btnDirections.href = mapUrl;
                }
            }

            const modal = document.getElementById('placeDetailModal');
            if (modal) {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
                modal.scrollTop = 0;
            }

            try {
                if (!window.location.hash.includes(String(id))) {
                    history.pushState({ modal: 'detail', id: String(id) }, '', '#' + id);
                }
            } catch (e) {}
        }

        // Đóng Modal Chi Tiết Quán
        function closeDetailModal() {
            closeFullGalleryModal(); // Luôn đóng cả bộ sưu tập ảnh nếu đang mở
            const modal = document.getElementById('placeDetailModal');
            if (modal) {
                modal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
            try {
                // Xóa hash để đóng modal nhưng không reload trang
                if (window.location.hash) {
                    // Dùng pushState để thay đổi URL mà không reload trang
                    history.pushState(null, '', window.location.pathname + window.location.search);
                    // Manually trigger hashchange để checkHashAndOpenModal xử lý
                    checkHashAndOpenModal();
                }
            } catch (e) {}
        }

        // Chia sẻ địa điểm quán
        function handleSharePlace() {
            if (!currentDetailPlaceId) return;
            const place = places.find(p => String(p.id) === String(currentDetailPlaceId));
            const title = place ? `${place.name} — hafu food` : 'hafu food';
            const url = window.location.href;
            if (navigator.share) {
                navigator.share({ title, url }).catch(() => {});
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Đã sao chép liên kết quán vào bộ nhớ tạm: ' + (place ? place.name : ''));
                }).catch(() => {});
            }
        }


        // Xem toàn bộ ảnh của quán chuẩn Cafe Maps
        function openFullGalleryModal() {
            if (!currentDetailPhotos || currentDetailPhotos.length === 0) return;
            const galleryModal = document.getElementById('fullGalleryModal');
            const titleEl = document.getElementById('fullGalleryTitle');
            const gridEl = document.getElementById('fullGalleryGrid');
            if (!galleryModal || !gridEl) return;

            const place = places.find(p => String(p.id) === String(currentDetailPlaceId));
            if (titleEl) {
                titleEl.innerText = place ? `${place.name} • ${currentDetailPhotos.length} ảnh` : `Bộ sưu tập • ${currentDetailPhotos.length} ảnh`;
            }

            gridEl.innerHTML = currentDetailPhotos.map((url, i) => `
                <div class="rounded-2xl overflow-hidden bg-stone-100 border border-[#EAE3DC] aspect-4/3 shadow-2xs group cursor-pointer" onclick="openPhotoLightbox(${i})">
                    <img src="${url}" alt="Ảnh ${i + 1}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                </div>
            `).join('');

            galleryModal.classList.remove('hidden');
            galleryModal.scrollTop = 0;
            document.body.style.overflow = 'hidden';

            try {
                history.pushState({ modal: 'gallery', id: currentDetailPlaceId }, '', '#gallery');
            } catch (e) {}
        }

        // Đóng bộ sưu tập ảnh và quay lại màn hình chi tiết quán
        function closeFullGalleryModal() {
            const galleryModal = document.getElementById('fullGalleryModal');
            if (galleryModal) {
                galleryModal.classList.add('hidden');
            }
            // Dọn dẹp nếu có div cũ được tạo động
            const oldDynamicModal = document.getElementById('fullGalleryLightModal');
            if (oldDynamicModal) {
                oldDynamicModal.remove();
            }

            // Đảm bảo trang chi tiết quán LUÔN HIỂN THỊ và cuộn được
            const detailModal = document.getElementById('placeDetailModal');
            if (detailModal) {
                detailModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }

            try {
                if (window.location.hash === '#gallery') {
                    if (currentDetailPlaceId) {
                        // Chuyển về hash của quán thay vì gallery
                        history.pushState({ modal: 'detail', id: currentDetailPlaceId }, '', '#' + currentDetailPlaceId);
                        // Manually trigger hashchange
                        checkHashAndOpenModal();
                    } else {
                        // Xóa hash hoàn toàn
                        history.pushState(null, '', window.location.pathname + window.location.search);
                        checkHashAndOpenModal();
                    }
                }
            } catch (e) {}
        }


        // ================= LIGHTBOX XEM & CHUYỂN ẢNH TOÀN MÀN HÌNH =================
        let currentLightboxIndex = 0;
        let lightboxTouchStartX = 0;
        let lightboxTouchStartY = 0;

        function openPhotoLightbox(index = 0) {
            if (!currentDetailPhotos || currentDetailPhotos.length === 0) return;
            const modal = document.getElementById('photoLightboxModal');
            if (!modal) return;

            currentLightboxIndex = Math.max(0, Math.min(index, currentDetailPhotos.length - 1));
            renderLightboxContent();

            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';

            // Gắn sự kiện vuốt cảm ứng trên mobile cho Lightbox
            if (!modal.dataset.touchBound) {
                modal.dataset.touchBound = 'true';
                modal.addEventListener('touchstart', (e) => {
                    if (e.touches && e.touches.length > 0) {
                        lightboxTouchStartX = e.touches[0].clientX;
                        lightboxTouchStartY = e.touches[0].clientY;
                    }
                }, { passive: true });

                modal.addEventListener('touchend', (e) => {
                    if (e.changedTouches && e.changedTouches.length > 0) {
                        const diffX = e.changedTouches[0].clientX - lightboxTouchStartX;
                        const diffY = e.changedTouches[0].clientY - lightboxTouchStartY;
                        // Chỉ kích hoạt nếu vuốt ngang chủ đạo và đủ độ dài (>40px)
                        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
                            if (diffX < 0) {
                                // Vuốt sang trái -> Xem ảnh tiếp theo
                                lightboxNextPhoto();
                            } else {
                                // Vuốt sang phải -> Xem ảnh trước
                                lightboxPrevPhoto();
                            }
                        }
                    }
                }, { passive: true });
            }
        }

        function renderLightboxContent() {
            if (!currentDetailPhotos || currentDetailPhotos.length === 0) return;
            const total = currentDetailPhotos.length;
            const currentUrl = currentDetailPhotos[currentLightboxIndex];

            // 1. Cập nhật ảnh chính
            const mainImg = document.getElementById('lightboxMainImg');
            if (mainImg) {
                mainImg.src = currentUrl;
                mainImg.alt = `Ảnh ${currentLightboxIndex + 1} / ${total}`;
            }

            // 2. Cập nhật bộ đếm ảnh
            const counter = document.getElementById('lightboxCounter');
            if (counter) {
                counter.innerText = `${currentLightboxIndex + 1} / ${total}`;
            }

            // 3. Ẩn/hiện nút mũi tên nếu chỉ có 1 ảnh
            const btnPrev = document.getElementById('btnLightboxPrev');
            const btnNext = document.getElementById('btnLightboxNext');
            if (btnPrev && btnNext) {
                if (total <= 1) {
                    btnPrev.classList.add('hidden');
                    btnNext.classList.add('hidden');
                } else {
                    btnPrev.classList.remove('hidden');
                    btnNext.classList.remove('hidden');
                }
            }

            // 4. Render danh sách thumbnail phía dưới
            const thumbsContainer = document.getElementById('lightboxThumbnails');
            if (thumbsContainer) {
                if (total <= 1) {
                    thumbsContainer.parentElement.classList.add('hidden');
                } else {
                    thumbsContainer.parentElement.classList.remove('hidden');
                    thumbsContainer.innerHTML = currentDetailPhotos.map((url, i) => {
                        const isActive = i === currentLightboxIndex;
                        return `
                            <div id="lightboxThumb_${i}" onclick="switchLightboxPhoto(${i})"
                                class="w-11 h-11 sm:w-14 sm:h-14 rounded-lg overflow-hidden cursor-pointer flex-shrink-0 transition-all duration-200 ${
                                    isActive
                                        ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#14100E] opacity-100 scale-105 shadow-md'
                                        : 'opacity-40 hover:opacity-80 border border-white/15'
                                }">
                                <img src="${url}" alt="Thumb ${i + 1}" loading="lazy" class="w-full h-full object-cover pointer-events-none">
                            </div>
                        `;
                    }).join('');

                    // Cuộn thumbnail đang chọn vào vị trí giữa
                    setTimeout(() => {
                        const activeEl = document.getElementById(`lightboxThumb_${currentLightboxIndex}`);
                        if (activeEl) {
                            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                        }
                    }, 50);
                }
            }
        }

        function switchLightboxPhoto(index) {
            if (!currentDetailPhotos || currentDetailPhotos.length === 0) return;
            currentLightboxIndex = (index + currentDetailPhotos.length) % currentDetailPhotos.length;
            renderLightboxContent();
        }

        function lightboxNextPhoto() {
            if (!currentDetailPhotos || currentDetailPhotos.length <= 1) return;
            switchLightboxPhoto(currentLightboxIndex + 1);
        }

        function lightboxPrevPhoto() {
            if (!currentDetailPhotos || currentDetailPhotos.length <= 1) return;
            switchLightboxPhoto(currentLightboxIndex - 1);
        }

        function closePhotoLightbox() {
            const modal = document.getElementById('photoLightboxModal');
            if (modal) {
                modal.classList.add('hidden');
            }

            // Nếu modal chi tiết quán vẫn đang mở, giữ nguyên chặn cuộn cho trang chi tiết
            const detailModal = document.getElementById('placeDetailModal');
            if (detailModal && !detailModal.classList.contains('hidden')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }

        function handleLightboxBackdropClick(event) {
            if (event.target && event.target.id === 'photoLightboxModal') {
                closePhotoLightbox();
            }
        }

        // ================= XỬ LÝ QUAY LẠI BẰNG CHUỘT VÀ CON TRỎ =================
        let lastBackActionTime = 0; // Chống kích hoạt đúp (Debounce) giữa sự kiện chuột và popstate của trình duyệt

        // Đóng bằng click con trỏ vào khoảng trống (Đã tắt đối với trang chi tiết để tránh click nhầm khi lướt web trên PC)
        function handleDetailBackdropClick(event) {
            // Không tự động đóng khi click vào 2 bên lề trang chi tiết trên PC để tránh thoát ngoài ý muốn.
            // Người dùng có thể dùng nút "Quay lại", phím Esc hoặc nút Back của trình duyệt/chuột.
        }

        function handleGalleryBackdropClick(event) {
            if (event.target && event.target.id === 'fullGalleryModal') {
                closeFullGalleryModal();
            }
        }

        // Hàm xử lý quay lại chung cho mọi thao tác (Nút chuột Back, Vuốt chuột, Phím Back, Phím Escape)
        function handleBackAction() {
            const now = Date.now();
            if (now - lastBackActionTime < 350) {
                return false; // Ngăn chặn nhảy 2 lần liên tiếp khi chuột gửi cả event lẫn popstate
            }

            // 0. Ưu tiên cao nhất: Nếu đang mở Lightbox xem ảnh thì đóng Lightbox trước!
            const lightboxModal = document.getElementById('photoLightboxModal');
            if (lightboxModal && !lightboxModal.classList.contains('hidden')) {
                lastBackActionTime = now;
                closePhotoLightbox();
                return true;
            }

            // 1. Ưu tiên: Nếu đang mở bộ ảnh thì CHỈ ĐÓNG BỘ ẢNH, giữ nguyên màn hình chi tiết quán!
            const galleryModal = document.getElementById('fullGalleryModal');
            const oldDynamicModal = document.getElementById('fullGalleryLightModal');
            if ((galleryModal && !galleryModal.classList.contains('hidden')) || oldDynamicModal) {
                lastBackActionTime = now;
                closeFullGalleryModal();
                return true;
            }

            // 2. Nếu đang mở chỉnh sửa quán thì đóng chỉnh sửa và trở lại trang chi tiết của quán
            const editModal = document.getElementById('editModal');
            if (editModal && !editModal.classList.contains('hidden')) {
                lastBackActionTime = now;
                cancelEditModal();
                return true;
            }

            // 3. Nếu đang mở thêm quán mới thì đóng modal thêm
            const addModal = document.getElementById('addModal');
            if (addModal && !addModal.classList.contains('hidden')) {
                lastBackActionTime = now;
                toggleModal(false);
                return true;
            }

            // 4. Nếu đang mở chi tiết quán thì đóng về trang chủ
            const detailModal = document.getElementById('placeDetailModal');
            if (detailModal && !detailModal.classList.contains('hidden')) {
                lastBackActionTime = now;
                closeDetailModal();
                return true;
            }

            return false;
        }

        // 1. Bắt sự kiện nút Back phụ trên chuột máy tính (Mouse Button 3 / Thumb Back Button)
        ['mouseup', 'auxclick', 'pointerup', 'mousedown'].forEach(eventType => {
            window.addEventListener(eventType, (e) => {
                if (e.button === 3) { // 3 = Nút Back phụ bên hông chuột
                    e.preventDefault();
                    e.stopPropagation();
                    if (eventType === 'mouseup' || eventType === 'auxclick') {
                        handleBackAction();
                    }
                }
            }, true);
        });

        // 2. Chặn hoàn toàn cử chỉ vuốt ngang / kéo trackpad 2 ngón tay trên PC gây Back/Forward trang web
        window.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                // Cho phép cuộn ngang đối với các vùng có thanh cuộn ngang hợp lệ (như thanh lọc quán)
                const scrollableX = e.target && e.target.closest && e.target.closest('.filter-scroll-track, .overflow-x-auto, [data-scrollable="x"]');
                if (!scrollableX) {
                    // Ngăn chặn hành vi Overscroll Navigation (kéo sang trái/phải để Back/Forward) của Chrome, Edge
                    if (e.cancelable) {
                        e.preventDefault();
                    }
                }
            }
        }, { passive: false });

        // 3. Xử lý nút Back của trình duyệt (trên điện thoại hoặc chuột máy tính)
        window.addEventListener('popstate', (e) => {
            const now = Date.now();
            if (now - lastBackActionTime < 350) {
                return; // Đã xử lý bởi sự kiện chuột trước đó, bỏ qua để không bị nhảy đúp
            }

            // 0. Nếu đang mở Lightbox xem ảnh: chỉ đóng Lightbox trước
            const lightboxModal = document.getElementById('photoLightboxModal');
            if (lightboxModal && !lightboxModal.classList.contains('hidden')) {
                lastBackActionTime = now;
                closePhotoLightbox();
                return;
            }

            // Nếu bộ ảnh đang mở: chỉ đóng bộ ảnh và giữ lại chi tiết quán
            const galleryModal = document.getElementById('fullGalleryModal');
            const oldDynamicModal = document.getElementById('fullGalleryLightModal');
            if ((galleryModal && !galleryModal.classList.contains('hidden')) || oldDynamicModal) {
                lastBackActionTime = now;
                closeFullGalleryModal();
                return;
            }

            // Nếu đang mở chỉnh sửa quán: đóng chỉnh sửa và giữ nguyên trang chi tiết quán
            const editModal = document.getElementById('editModal');
            if (editModal && !editModal.classList.contains('hidden')) {
                lastBackActionTime = now;
                cancelEditModal();
                return;
            }

            // Nếu đang mở chi tiết quán: đóng về trang chủ
            const detailModal = document.getElementById('placeDetailModal');
            if (detailModal && !detailModal.classList.contains('hidden')) {
                lastBackActionTime = now;
                closeDetailModal();
                return;
            }
        });

        // 4. Lắng nghe phím Escape, Mũi tên trái/phải để chuyển ảnh và đóng nhanh
        document.addEventListener('keydown', (e) => {
            const lightboxModal = document.getElementById('photoLightboxModal');
            if (lightboxModal && !lightboxModal.classList.contains('hidden')) {
                if (e.key === 'Escape') {
                    closePhotoLightbox();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    lightboxNextPhoto();
                    return;
                }
                if (e.key === 'ArrowLeft') {
                    lightboxPrevPhoto();
                    return;
                }
            }

            if (e.key === 'Escape') {
                handleBackAction();
                return;
            }
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if ((e.altKey && e.key === 'ArrowLeft') || e.key === 'Backspace') {
                if (handleBackAction()) {
                    e.preventDefault();
                }
            }
        });
        // ================= KẾT THÚC XỬ LÝ QUAY LẠI BẰNG CHUỘT =================


        // Cập nhật trạng thái giao diện của các nút trong thanh đáy modal chi tiết
        function updateDetailActionButtons() {
            if (!currentDetailPlaceId) return;

            // Nút Đã đi
            const isVisited = visitedIds.includes(currentDetailPlaceId);
            const btnVisited = document.getElementById('btnDetailVisited');
            const iconVisited = document.getElementById('detailVisitedIcon');
            if (btnVisited && iconVisited) {
                if (isVisited) {
                    btnVisited.className = "h-11 px-3 sm:px-4 rounded-full bg-[#EBF5EE] border border-[#2E7D32] text-[#2E7D32] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer";
                    iconVisited.className = "fa-solid fa-check text-xs text-[#2E7D32] flex-shrink-0 leading-none";
                } else {
                    btnVisited.className = "h-11 px-3 sm:px-4 rounded-full bg-white border border-stone-200 hover:border-[#2E7D32] text-stone-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer";
                    iconVisited.className = "fa-solid fa-check text-xs text-stone-500 flex-shrink-0 leading-none";
                }
            }

            // Nút Yêu thích
            const isFav = favoriteIds.includes(currentDetailPlaceId);
            const btnFavorite = document.getElementById('btnDetailFavorite');
            const iconFavorite = document.getElementById('detailFavoriteIcon');
            const textFavorite = document.getElementById('detailFavoriteText');
            if (btnFavorite && iconFavorite && textFavorite) {
                if (isFav) {
                    btnFavorite.className = "h-11 px-3 sm:px-4 rounded-full bg-[#FFF0F5] border border-[#C2185B] text-[#C2185B] font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer";
                    iconFavorite.className = "fa-solid fa-heart text-xs text-[#C2185B] flex-shrink-0 leading-none";
                    textFavorite.innerText = "Đã thích";
                } else {
                    btnFavorite.className = "h-11 px-3 sm:px-4 rounded-full bg-white border border-stone-200 hover:border-[#C2185B] text-stone-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer";
                    iconFavorite.className = "fa-regular fa-heart text-xs text-stone-500 flex-shrink-0 leading-none";
                    textFavorite.innerText = "Yêu thích";
                }
            }
        }

        // Xử lý bật/tắt Yêu thích trong modal chi tiết
        function handleDetailToggleFavorite() {
            if (!currentDetailPlaceId) return;
            toggleFavorite(currentDetailPlaceId);
            updateDetailActionButtons();
        }

        // Xử lý bật/tắt Đã đi trong modal chi tiết
        function handleDetailToggleVisited() {
            if (!currentDetailPlaceId) return;
            if (visitedIds.includes(currentDetailPlaceId)) {
                visitedIds = visitedIds.filter(id => id !== currentDetailPlaceId);
            } else {
                visitedIds.push(currentDetailPlaceId);
            }
            localStorage.setItem('visitedIds', JSON.stringify(visitedIds));
            updateDetailActionButtons();
        }

        // Xử lý mở Modal Chỉnh sửa từ nút Sửa (vị trí khoanh đỏ)
        function handleDetailOpenEdit() {
            if (!currentDetailPlaceId) return;
            const id = currentDetailPlaceId;
            // Bắt buộc nhập mật khẩu bảo mật trước khi cho phép mở hộp thoại sửa
            openSecurityModal('edit_access', id);
        }

        // Xử lý Chỉ đường từ modal chi tiết (luôn mở chính xác Google Maps)
        function handleDetailDirections(event) {
            if (event) {
                try { event.preventDefault(); } catch (e) {}
                try { event.stopPropagation(); } catch (e) {}
            }
            if (!currentDetailPlaceId) return;
            const place = places.find(p => String(p.id) === String(currentDetailPlaceId));
            if (!place) return;
            const url = getPlaceMapUrl(place);
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        }


        // Bật/Tắt Modal thêm quán
        function toggleModal(show) {
            const modal = document.getElementById('addModal');
            if (modal) {
                if (show) {
                    modal.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                    addGalleryImages = [];
                    renderAddGalleryGrid();
                    const igInput = document.getElementById('inputInstagram');
                    if (igInput) igInput.value = '';
                    const geoStatus = document.getElementById('geoStatusAdd');
                    if (geoStatus) geoStatus.classList.add('hidden');
                } else {
                    modal.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                    addGalleryImages = [];
                }
            }
        }

        let currentEditingPlaceId = null;

        // Lấy ID quán cần quay lại sau khi đóng màn hình chỉnh sửa.
        // Không chỉ dựa vào currentDetailPlaceId vì modal chi tiết được ẩn
        // trong bước xác thực trước khi mở modal chỉnh sửa.
        function getEditingPlaceId() {
            const formId = document.getElementById('editId')?.value;
            const placeId = formId || currentEditingPlaceId || currentDetailPlaceId;
            return placeId === null || placeId === undefined || String(placeId).trim() === ''
                ? null
                : String(placeId).trim();
        }

        // Bật/Tắt Modal chỉnh sửa quán
        function toggleEditModal(show) {
            const modal = document.getElementById('editModal');
            if (modal) {
                if (show) {
                    modal.classList.remove('hidden');
                    document.body.style.overflow = 'hidden';
                    const geoStatus = document.getElementById('geoStatusEdit');
                    if (geoStatus) geoStatus.classList.add('hidden');
                } else {
                    modal.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                }
            }
        }

        // Đóng hoặc Hủy chỉnh sửa quán -> luôn quay lại trang chi tiết của quán đó thay vì ra trang chủ
        function cancelEditModal() {
            const placeId = getEditingPlaceId();
            toggleEditModal(false);
            if (placeId) {
                currentEditingPlaceId = placeId;
                currentDetailPlaceId = placeId;
                openDetailModal(placeId);
            }
        }

        // Bắt sự kiện bấm ra ngoài vùng xám backdrop của Edit Modal
        function handleEditBackdropClick(event) {
            if (event.target && event.target.id === 'editModal') {
                cancelEditModal();
            }
        }

        // Mở Modal chỉnh sửa và điền dữ liệu cũ (Đầy đủ tất cả thông tin đã show ra ở quán)
        function openEditModal(id) {
            const place = places.find(p => String(p.id) === String(id));
            if (!place) return;

            currentEditingPlaceId = String(id);
            currentDetailPlaceId = String(id);

            document.getElementById('editId').value = place.id;
            document.getElementById('editName').value = place.name || '';
            document.getElementById('editCategory').value = place.category || '';
            document.getElementById('editDistrict').value = place.district || '';
            document.getElementById('editAddress').value = place.address || '';
            document.getElementById('editOpeningHours').value = place.opening_hours || '';
            document.getElementById('editPrice').value = place.price || getPlacePrice(place);
            document.getElementById('editRating').value = place.rating || 5;
            document.getElementById('editSignatureDrink').value = place.signature_drink || '';
            // Chỉ dùng giá trị mặc định khi undefined/null, KHÔNG dùng khi chuỗi rỗng
            document.getElementById('editVibe').value = (place.vibe !== undefined && place.vibe !== null) ? place.vibe : '';
            document.getElementById('editPurpose').value = (place.purpose !== undefined && place.purpose !== null) ? place.purpose : '';
            // Chỉ dùng giá trị mặc định khi undefined/null, KHÔNG dùng khi chuỗi rỗng
            document.getElementById('editParking').value = (place.parking !== undefined && place.parking !== null) ? place.parking : 'Gửi xe trước quán (miễn phí)';
            document.getElementById('editAmenities').value = (place.amenities !== undefined && place.amenities !== null) ? place.amenities : 'wifi, điều hoà';
            document.getElementById('editIdealFor').value = (place.ideal_for !== undefined && place.ideal_for !== null) ? place.ideal_for : 'Làm việc remote, Hẹn hò nhẹ nhàng, Gặp bạn bè';

            // Bộ sưu tập ảnh (Gallery) — ảnh đầu tiên = ảnh chủ đề (Tối đa 5 ảnh)
            try {
                const raw = place.gallery_images;
                editGalleryImages = Array.isArray(raw) ? [...raw] : (raw ? JSON.parse(raw) : []);
            } catch (e) {
                editGalleryImages = [];
            }
            // Đảm bảo ảnh bìa đại diện hiện tại luôn ở vị trí 0 (Ảnh chủ đề)
            const existingCover = (place.image && place.image.trim()) || (place.image_url && place.image_url.trim()) || '';
            if (existingCover && !existingCover.startsWith('data:image/svg')) {
                const coverIdx = editGalleryImages.indexOf(existingCover);
                if (coverIdx > 0) {
                    const [cov] = editGalleryImages.splice(coverIdx, 1);
                    editGalleryImages.unshift(cov);
                } else if (coverIdx === -1) {
                    editGalleryImages.unshift(existingCover);
                }
            }
            // Giới hạn nghiêm ngặt tối đa 5 ảnh
            if (editGalleryImages.length > MAX_GALLERY_PHOTOS) {
                editGalleryImages = editGalleryImages.slice(0, MAX_GALLERY_PHOTOS);
            }
            renderEditGalleryGrid();

            // Instagram
            const igInput = document.getElementById('editInstagram');
            if (igInput) igInput.value = place.instagram || '';

            // Tọa độ GPS & Nhận xét
            document.getElementById('editLatLng').value = (place.lat && place.lng) ? `${place.lat},${place.lng}` : '';
            document.getElementById('editReview').value = cleanTextField(place.review) || '';

            toggleEditModal(true);
        }


        // Xử lý kích hoạt xóa từ Modal chỉnh sửa
        function deleteFromEditModal() {
            const id = document.getElementById('editId').value;
            if (id) {
                toggleEditModal(false); // Đóng modal chỉnh sửa
                openSecurityModal('delete', id); // Mở THẲNG modal nhập code bảo mật, không hỏi lại
            }
        }

        // Bật/Tắt Modal Xóa
        function deletePlace(id) {
            placeToDeleteId = id;
            document.getElementById('deleteModal').classList.remove('hidden');
        }

        function closeDeleteModal() {
            placeToDeleteId = null;
            document.getElementById('deleteModal').classList.add('hidden');
        }

        // Bật/Tắt Modal nhập mã bảo mật (Hiển thị đè lên trên cùng)
        function openSecurityModal(type, data) {
            pendingAction = { type, data };
            document.getElementById('confirmSecurityCode').value = '';
            document.getElementById('securityModal').classList.remove('hidden');
            document.getElementById('confirmSecurityCode').focus();
        }

        function closeSecurityModal() {
            document.getElementById('securityModal').classList.add('hidden');
        }

        function cancelSecurityModal() {
            pendingAction = null;
            closeSecurityModal();
        }

        function djb2Hash(str) {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
                hash = hash & 0xFFFFFFFF;
            }
            return (hash >>> 0).toString(16);
        }

        function verifySecurityCode() {
            try {
                const inputVal = document.getElementById('confirmSecurityCode').value.trim();

                // Băm mật khẩu người dùng nhập vào
                const hash = djb2Hash(inputVal);

                // Đối chiếu với mã băm đã lưu
                if (hash === "7de1d77c") {
                    executePendingAction(); // Thực thi trước để lấy pendingAction
                    closeSecurityModal();   // Đóng modal sau
                } else {
                    alert("Mã bảo mật không chính xác! Vui lòng thử lại.");
                }
            } catch (err) {
                alert("Lỗi xác thực: " + err.message);
            }
        }

        async function executePendingAction() {
            try {
                if (!pendingAction) return;
                const actionType = pendingAction.type;
                const actionData = pendingAction.data;

                // Xóa biến chờ trước khi thực thi
                pendingAction = null;

                if (actionType === 'delete') {
                    await proceedDelete(actionData);
                } else if (actionType === 'update') {
                    await proceedUpdate(actionData);
                } else if (actionType === 'edit_access') {
                    // Giữ lại ID trước khi ẩn trang chi tiết. Gọi closeDetailModal()
                    // ở đây sẽ xóa hash/trạng thái chi tiết, khiến nút X/Hủy không
                    // biết phải quay lại quán nào.
                    currentEditingPlaceId = String(actionData);
                    currentDetailPlaceId = String(actionData);
                    const detailModal = document.getElementById('placeDetailModal');
                    if (detailModal) {
                        detailModal.classList.add('hidden');
                    }
                    openEditModal(actionData);
                }
            } catch (err) {
                alert("Lỗi thực thi hành động: " + err.message);
            }
        }

        function confirmDelete() {
            if (placeToDeleteId !== null) {
                const targetId = placeToDeleteId;
                // Mở Modal bảo mật đè lên trên deleteModal (giữ nguyên deleteModal ở phía dưới)
                openSecurityModal('delete', targetId);
            }
        }


        // Cập nhật thông tin quán (Đã xác thực mật khẩu trước khi mở form)
        function handleUpdatePlace(e) {
            e.preventDefault();

            const id = parseInt(document.getElementById('editId').value);
            const name = sanitizeText(document.getElementById('editName').value).trim();
            const category = sanitizeText(document.getElementById('editCategory').value).trim();
            const district = sanitizeText(document.getElementById('editDistrict').value).trim();
            const address = sanitizeText(document.getElementById('editAddress').value).trim();
            if (editGalleryImages.length > MAX_GALLERY_PHOTOS) {
                editGalleryImages = editGalleryImages.slice(0, MAX_GALLERY_PHOTOS);
            }
            const image = editGalleryImages.length > 0 ? editGalleryImages[0] : '';
            const opening_hours = sanitizeText(document.getElementById('editOpeningHours').value).trim();
            const price = sanitizeText(document.getElementById('editPrice').value).trim();
            const rating = parseFloat(document.getElementById('editRating').value) || 5;
            const signature_drink = sanitizeText(document.getElementById('editSignatureDrink').value).trim();
            const vibe = sanitizeText(document.getElementById('editVibe').value).trim();
            const purpose = sanitizeText(document.getElementById('editPurpose').value).trim();
            const parking = sanitizeText(document.getElementById('editParking').value).trim();
            const amenities = sanitizeText(document.getElementById('editAmenities').value).trim();
            const ideal_for = sanitizeText(document.getElementById('editIdealFor').value).trim();
            const instagram = sanitizeText(document.getElementById('editInstagram') ? document.getElementById('editInstagram').value : '').trim();
            const gallery_images = JSON.stringify(editGalleryImages);
            const latLngInput = document.getElementById('editLatLng').value.trim();
            const review = sanitizeText(document.getElementById('editReview').value).trim();

            const updateData = {
                id, name, category, district, address, image, opening_hours, price, rating,
                signature_drink, vibe, purpose, parking, amenities, ideal_for, instagram, gallery_images, latLngInput, review
            };

            // Tiến hành cập nhật trực tiếp
            proceedUpdate(updateData);
        }

        // Thực hiện cập nhật thực tế
