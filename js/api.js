/**
 * API.JS - Cấu hình Supabase, lưu trữ dữ liệu và các hàm đồng bộ CRUD
 */

// Cấu hình kết nối Supabase
const SUPABASE_URL = "https://cqtqpejhcsjqpllhhsls.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHFwZWpoY3NqcXBsbGhoc2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MzMxOTYsImV4cCI6MjA5OTUwOTE5Nn0.gpA1BL8ccxli_l9lrWRpVjVYSysTMUDFI6wmpLwvbBk";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Dữ liệu quán cà phê toàn cục
let places = [];

        // Dữ liệu mẫu làm fallback dự phòng
        const defaultPlaces = [
            { id: 1, name: "Phê La - Tôn Thất Đạm", category: "Cafe", district: "Quận 1", address: "125 Tôn Thất Đạm, Bến Nghé", opening_hours: "07:00 - 22:00", rating: 4.8, review: "Trà Ô Long đậm vị, không gian cắm trại cực chill.", lat: 10.7725, lng: 106.7042, map_link: "", vibe: "Chill, Cắm trại", purpose: "Hẹn hò, Gặp bạn bè" },
            { id: 2, name: "Cơm Tấm Ba Ghiền", category: "Quán ăn", district: "Quận Phú Nhuận", address: "84 Đặng Văn Ngữ, Phường 10", opening_hours: "07:30 - 20:30", rating: 4.5, review: "Miếng sườn to bằng cái đĩa, ướp đậm đà.", lat: 10.7936, lng: 106.6713, map_link: "", vibe: "Bình dân, Nhộn nhịp", purpose: "Ăn trưa, Gặp bạn bè" },
            { id: 3, name: "The Workshop Coffee", category: "Cafe", district: "Quận 1", address: "27 Ngô Đức Kế, Bến Nghé", opening_hours: "08:00 - 21:00", rating: 4.6, review: "Cà phê specialty xịn xò, không gian làm việc lý tưởng.", lat: 10.7741, lng: 106.7051, map_link: "", vibe: "Làm việc, Specialty", purpose: "Làm việc remote, Họp nhóm" },
            { id: 4, name: "Bún bò Huế Hạnh", category: "Quán ăn", district: "Quận Tân Bình", address: "135 Bành Văn Trân, Phường 7", opening_hours: "06:30 - 21:00", rating: 4.4, review: "Nước dùng thanh, topping ngập tràn.", lat: 10.7878, lng: 106.6558, map_link: "", vibe: "Ấm cúng, Đậm đà", purpose: "Ăn sáng, Gia đình" },
            { id: 5, name: "Cheese Coffee - Sư Vạn Hạnh", category: "Cafe", district: "Quận 10", address: "747 Sư Vạn Hạnh, Phường 12", opening_hours: "07:00 - 22:30", rating: 4.3, review: "Phong cách châu Âu hiện đại, đồ uống béo ngậy.", lat: 10.7745, lng: 106.6678, map_link: "", vibe: "Hiện đại, Châu Âu", purpose: "Sống ảo, Hẹn hò" },
            { id: 6, name: "Ốc Đào", category: "Quán ăn", district: "Quận 1", address: "Hẻm 212B Nguyễn Trãi, Nguyễn Cư Trinh", opening_hours: "10:30 - 22:00", rating: 4.2, review: "Hương vị nêm nếm đậm chất Sài Gòn, giá hơi cao.", lat: 10.7634, lng: 106.6853, map_link: "", vibe: "Nhộn nhịp, Tụ tập", purpose: "Tụ tập bạn bè, Nhậu đêm" }
        ];

        // Đọc/ghi bản sao cục bộ an toàn. Bản sao này rất quan trọng khi Storage/RLS
        // chưa được cấu hình hoặc khi người dùng vừa thêm ảnh Base64.
        function getStoredPlaces() {
            try {
                const stored = JSON.parse(localStorage.getItem('places') || 'null');
                if (!Array.isArray(stored)) return [];
                // Tự động quét và loại bỏ triệt để chuỗi base64 khỏi các trường text trong localStorage
                let hasDirty = false;
                const cleaned = stored.map(p => {
                    const norm = normalizePlaceTextFields(p);
                    if (JSON.stringify(norm) !== JSON.stringify(p)) hasDirty = true;
                    return norm;
                });
                if (hasDirty) {
                    try { localStorage.setItem('places', JSON.stringify(cleaned)); } catch (e) {}
                }
                return cleaned;
            } catch (err) {
                console.warn("Không thể đọc dữ liệu quán từ localStorage:", err);
                return [];
            }
        }

        function savePlacesLocally() {
            try {
                localStorage.setItem('places', JSON.stringify(places));
            } catch (err) {
                // Không làm hỏng thao tác thêm/sửa nếu localStorage bị đầy hoặc bị chặn.
                console.error("Không thể lưu bản sao quán vào localStorage:", err);
            }
        }

        function markPlaceImagesAsLocallyStored(place) {
            try {
                const localImageState = JSON.parse(localStorage.getItem('placeImageState') || '{}');
                const state = localImageState[String(place.id)] || {};
                if (hasImageValue(place.image)) state.image = place.image;
                if (hasGalleryValue(place.gallery_images)) state.gallery_images = place.gallery_images;
                localImageState[String(place.id)] = state;
                localStorage.setItem('placeImageState', JSON.stringify(localImageState));
            } catch (err) {
                console.warn("Không thể lưu trạng thái ảnh cục bộ:", err);
            }
        }

        function getLocallyStoredImageState(placeId) {
            try {
                const state = JSON.parse(localStorage.getItem('placeImageState') || '{}');
                return state[String(placeId)] || {};
            } catch (err) {
                return {};
            }
        }

        function containsLocalImage(value) {
            if (typeof value === 'string' && value.startsWith('data:image/')) return true;
            if (Array.isArray(value)) return value.some(containsLocalImage);
            if (typeof value === 'string' && value.trim().startsWith('[')) {
                try {
                    return containsLocalImage(JSON.parse(value));
                } catch (err) {
                    return false;
                }
            }
            return false;
        }

        function markImageStateAfterLocalChange(place) {
            if (hasImageValue(place.image) || hasGalleryValue(place.gallery_images)) {
                markPlaceImagesAsLocallyStored(place);
            } else {
                clearLocalImageState(place.id);
            }
        }

        function clearLocalImageState(placeId, fields = ['image', 'gallery_images']) {
            try {
                const localImageState = JSON.parse(localStorage.getItem('placeImageState') || '{}');
                const state = localImageState[String(placeId)];
                if (!state) return;
                fields.forEach(field => delete state[field]);
                if (Object.keys(state).length === 0) delete localImageState[String(placeId)];
                localStorage.setItem('placeImageState', JSON.stringify(localImageState));
            } catch (err) {
                console.warn("Không thể xóa trạng thái ảnh cục bộ:", err);
            }
        }

        function hasImageValue(value) {
            return typeof value === 'string' && value.trim() !== '';
        }

        function hasGalleryValue(value) {
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value !== 'string' || value.trim() === '') return false;
            try {
                const gallery = JSON.parse(value);
                return Array.isArray(gallery) && gallery.length > 0;
            } catch (err) {
                return false;
            }
        }

        // Trích xuất metadata mở rộng từ trường review và chuẩn hóa ảnh từ gallery
        function unpackPlaceMeta(rawPlace) {
            if (!rawPlace) return rawPlace;
            const place = { ...rawPlace };

            // 1. Phân tích Gallery ảnh để trích xuất ảnh bìa
            let gallery = [];
            try {
                if (Array.isArray(place.gallery_images)) {
                    gallery = place.gallery_images;
                } else if (typeof place.gallery_images === 'string' && place.gallery_images.trim()) {
                    gallery = JSON.parse(place.gallery_images);
                    if (!Array.isArray(gallery)) gallery = [];
                }
            } catch (e) {
                gallery = [];
            }
            place.gallery_images = JSON.stringify(gallery.filter(img => typeof img === 'string' && img.trim()).map(img => img.trim()));
            if (!place.image && gallery.length > 0 && typeof gallery[0] === 'string' && gallery[0].trim()) {
                place.image = gallery[0].trim();
            }

            // 2. Trích xuất metadata mở rộng từ review (nếu có lưu)
            if (typeof place.review === 'string' && place.review.includes('<!--EXT_META:')) {
                const match = place.review.match(/<!--EXT_META:(.*?)-->/s);
                if (match) {
                    try {
                        const extra = JSON.parse(match[1]);
                        Object.keys(extra).forEach(key => {
                            // Chấp nhận cả giá trị rỗng để có thể xóa dữ liệu cũ
                            if (extra[key] !== undefined && extra[key] !== null) {
                                place[key] = extra[key];
                            }
                        });
                    } catch (e) {
                        console.warn('Lỗi phân tích EXT_META của quán', place.id, e);
                    }
                    place.review = place.review.replace(/\s*<!--EXT_META:.*?-->/s, '').trim();
                }
            }

            return place;
        }

        // Đóng gói metadata mở rộng vào review để lưu vĩnh viễn trên Supabase mà không bị lỗi thiếu cột
        function packPlaceMeta(review, extraData) {
            let cleanReview = (review || '').trim();
            cleanReview = cleanReview.replace(/\s*<!--EXT_META:.*?-->/s, '').trim();

            const cleanExtra = {};
            Object.keys(extraData || {}).forEach(key => {
                const val = extraData[key];
                // Lưu tất cả các giá trị, kể cả chuỗi rỗng để có thể xóa dữ liệu cũ
                if (val !== null && val !== undefined) {
                    cleanExtra[key] = val;
                }
            });

            if (Object.keys(cleanExtra).length === 0) {
                return cleanReview;
            }

            const metaString = `<!--EXT_META:${JSON.stringify(cleanExtra)}-->`;
            return cleanReview ? `${cleanReview}\n${metaString}` : metaString;
        }

        // Hợp nhất dữ liệu remote và local một cách an toàn
        function mergeRemotePlaceWithLocal(remotePlace, localPlace) {
            const merged = { ...remotePlace };
            const localImageState = getLocallyStoredImageState(remotePlace.id);

            if (hasImageValue(localImageState.image)) {
                merged.image = localImageState.image;
            } else if (!hasImageValue(merged.image) && localPlace && hasImageValue(localPlace.image)) {
                merged.image = localPlace.image;
            }
            if (localPlace && !hasImageValue(merged.image_url) && hasImageValue(localPlace.image_url)) {
                merged.image_url = localPlace.image_url;
            }
            if (hasGalleryValue(localImageState.gallery_images)) {
                merged.gallery_images = localImageState.gallery_images;
            } else if (!hasGalleryValue(merged.gallery_images) && localPlace && hasGalleryValue(localPlace.gallery_images)) {
                merged.gallery_images = localPlace.gallery_images;
            }

            // KHÔNG merge các trường metadata từ localPlace nữa, vì chúng đã được lưu trong Supabase
            // Nếu merge, sẽ ghi đè lại giá trị rỗng mà người dùng vừa xóa
            
            return merged;
        }

        // Hàm tải dữ liệu từ Supabase
        async function loadPlaces() {
            const storedPlaces = getStoredPlaces();
            const localById = new Map(storedPlaces.map(place => [String(place.id), place]));

            try {
                const { data, error } = await supabaseClient
                    .from('places')
                    .select('*')
                    .order('id', { ascending: false });

                if (error) throw error;

                const remotePlaces = Array.isArray(data) ? data : [];
                const remoteIds = new Set(remotePlaces.map(place => String(place.id)));
                // Giữ lại các bản ghi có ID tạm (Date.now) chưa kịp đồng bộ lên Supabase.
                const pendingLocalPlaces = storedPlaces.filter(place => {
                    const id = String(place.id || '');
                    return id.length > 10 && !remoteIds.has(id);
                });
                places = [
                    ...pendingLocalPlaces,
                    ...remotePlaces.map(remotePlace => {
                        const unpacked = unpackPlaceMeta(remotePlace);
                        return mergeRemotePlaceWithLocal(unpacked, localById.get(String(unpacked.id)));
                    })
                ].map(normalizePlaceTextFields);

                // Đồng bộ bản sao cục bộ an toàn
                savePlacesLocally();
            } catch (err) {
                console.error("Lỗi khi tải dữ liệu từ Supabase (Chuyển sang dùng bộ nhớ cục bộ):", err);
                places = (storedPlaces.length > 0 ? storedPlaces : defaultPlaces).map(normalizePlaceTextFields);
            }
            updateFilters();
            renderPlaces();
        }

        function normalizePlaceTextFields(place) {
            if (!place) return place;
            const normalized = { ...place };
            ['name', 'category', 'district', 'address', 'opening_hours', 'review', 'map_link',
             'price', 'signature_drink', 'vibe', 'purpose', 'parking', 'amenities', 'ideal_for', 'instagram'].forEach(field => {
                if (normalized[field] != null) {
                    normalized[field] = cleanTextField(normalized[field]);
                }
            });
            return normalized;
        }






        // Cập nhật Đánh giá Sao nhanh từ màn hình chính (So sánh chuỗi an toàn)
        async function updateRating(id, newRating) {
            event.stopPropagation(); // Tránh kích hoạt các sự kiện click khác
            const oldRating = (places.find(p => String(p.id) === String(id)) || {}).rating || 5;
            places = places.map(p => String(p.id) === String(id) ? { ...p, rating: newRating } : p);
            renderPlaces();
            savePlacesLocally();

            try {
                const { error } = await supabaseClient
                    .from('places')
                    .update({ rating: newRating })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error("Không thể lưu đánh giá mới lên Supabase:", err);
                alert("Lỗi Supabase khi cập nhật sao: " + err.message + "\n(Vui lòng kiểm tra phân quyền RLS Policies trên database)");
                // Hoàn tác lại rating cũ nếu lỗi
                places = places.map(p => String(p.id) === String(id) ? { ...p, rating: oldRating } : p);
                renderPlaces();
                savePlacesLocally();
            }
        }


        async function proceedDelete(deleteId) {
            if (deleteId !== null) {
                const deleteTarget = String(deleteId).trim();

                // Chốt chặn 1: Nếu ID trống hoặc không hợp lệ, thoát ngay lập tức
                if (deleteTarget === "" || deleteTarget === "null" || deleteTarget === "undefined") {
                    return;
                }

                // Kiểm tra xem có phải ID tạm thời cục bộ tự tạo không (ID Date.now() dài 13 ký tự)
                const isTempId = deleteTarget.length > 10 || isNaN(Number(deleteTarget));

                if (!isTempId) {
                    const idInt = parseInt(deleteTarget);

                    // Chốt chặn 2: Bảo vệ cơ sở dữ liệu. Nếu idInt là NaN hoặc không hợp lệ, chặn đứng lệnh gửi lên Supabase.
                    if (!isNaN(idInt) && idInt > 0) {
                        try {
                            const { error } = await supabaseClient
                                .from('places')
                                .delete()
                                .eq('id', idInt);
                            if (error) throw error;
                        } catch (err) {
                            console.error("Lỗi khi xóa trên Supabase:", err);
                            alert("Lỗi Supabase khi xóa quán: " + err.message);
                        }
                    } else {
                        console.warn("Chặn lệnh xóa Supabase để bảo vệ bảng do ID không hợp lệ:", idInt);
                    }
                }

                // Lọc bỏ quán ăn ở localStorage để cập nhật ngay giao diện cục bộ
                places = places.filter(p => String(p.id) !== deleteTarget);
                clearLocalImageState(deleteTarget);
                savePlacesLocally();

                toggleEditModal(false); // Đóng modal chỉnh sửa
                updateFilters();
                renderPlaces();
            }
        }


        // Thêm mới quán
        async function handleAddNewPlace(e) {
            e.preventDefault();

            const name = sanitizeText(document.getElementById('inputName').value).trim();
            const category = sanitizeText(document.getElementById('inputCategory').value).trim();
            const district = sanitizeText(document.getElementById('inputDistrict').value).trim();
            const address = sanitizeText(document.getElementById('inputAddress').value).trim();
            const opening_hours = sanitizeText(document.getElementById('inputOpeningHours') ? document.getElementById('inputOpeningHours').value : '').trim();
            const price = sanitizeText(document.getElementById('inputPrice') ? document.getElementById('inputPrice').value : '').trim();
            const rating = parseFloat(document.getElementById('inputRating') ? document.getElementById('inputRating').value : 5) || 5;
            const signature_drink = sanitizeText(document.getElementById('inputSignatureDrink') ? document.getElementById('inputSignatureDrink').value : '').trim();
            const vibe = sanitizeText(document.getElementById('inputVibe') ? document.getElementById('inputVibe').value : '').trim();
            const ideal_for = sanitizeText(document.getElementById('inputIdealFor') ? document.getElementById('inputIdealFor').value : '').trim();
            const amenities = sanitizeText(document.getElementById('inputAmenities') ? document.getElementById('inputAmenities').value : '').trim();
            const parking = sanitizeText(document.getElementById('inputParking') ? document.getElementById('inputParking').value : '').trim();
            const instagram = sanitizeText(document.getElementById('inputInstagram') ? document.getElementById('inputInstagram').value : '').trim();
            const latLngInput = document.getElementById('inputLatLng') ? document.getElementById('inputLatLng').value.trim() : '';
            const review = sanitizeText(document.getElementById('inputReview').value).trim();

            // Xử lý tọa độ GPS (hỗ trợ nhập tay)
            let lat = null;
            let lng = null;
            const coords = extractLatLng(latLngInput);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
            }

            // Đóng gói metadata các trường mở rộng không có cột riêng trên bảng places của Supabase
            const extraData = {};
            if (instagram) extraData.instagram = instagram;
            if (price) extraData.price = price;
            if (signature_drink) extraData.signature_drink = signature_drink;
            if (vibe) extraData.vibe = vibe;
            if (ideal_for) {
                extraData.ideal_for = ideal_for;
                extraData.purpose = ideal_for;
            }
            if (amenities) extraData.amenities = amenities;
            if (parking) extraData.parking = parking;
            const packedReview = packPlaceMeta(review, extraData);

            // Lưu ảnh vào gallery_images dạng JSON mảng (chuẩn cơ sở dữ liệu Supabase, tối đa 5 ảnh)
            const rawUrl = sanitizeText(document.getElementById('addGalleryUrl') ? document.getElementById('addGalleryUrl').value : '').trim();
            if (rawUrl && addGalleryImages.length < MAX_GALLERY_PHOTOS && !addGalleryImages.includes(rawUrl)) {
                addGalleryImages.push(rawUrl);
            }
            const galleryList = addGalleryImages.slice(0, MAX_GALLERY_PHOTOS);
            const image = galleryList.length > 0 ? galleryList[0] : '';
            const gallery_images = JSON.stringify(galleryList);

            // Payload CHỈ gồm các cột CÓ THỰC trên bảng places của Supabase
            const dbPayload = {
                name,
                category,
                district,
                address,
                opening_hours: opening_hours || null,
                rating: rating || 5,
                review: packedReview,
                lat,
                lng,
                gallery_images
            };

            const localNewPlace = {
                ...dbPayload,
                image: image || null,
                instagram: instagram || null,
                price: price || null,
                signature_drink: signature_drink || null,
                vibe: vibe || null,
                ideal_for: ideal_for || null,
                purpose: ideal_for || null,
                amenities: amenities || null,
                parking: parking || null,
                rating: rating || 5,
                review
            };

            try {
                // Thêm vào Supabase và lấy về bản ghi có chứa ID tự động sinh
                const { data, error } = await supabaseClient
                    .from('places')
                    .insert([dbPayload])
                    .select();

                if (error) throw error;

                if (data && data.length > 0 && data[0].id) {
                    const savedPlace = unpackPlaceMeta(data[0]);
                    savedPlace.image = image || savedPlace.image;
                    savedPlace.instagram = instagram || savedPlace.instagram;
                    savedPlace.price = price || savedPlace.price;
                    savedPlace.signature_drink = signature_drink || savedPlace.signature_drink;
                    savedPlace.vibe = vibe || savedPlace.vibe;
                    savedPlace.ideal_for = ideal_for || savedPlace.ideal_for;
                    savedPlace.purpose = ideal_for || savedPlace.purpose;
                    savedPlace.amenities = amenities || savedPlace.amenities;
                    savedPlace.parking = parking || savedPlace.parking;
                    savedPlace.rating = rating || savedPlace.rating;
                    savedPlace.review = review;

                    places.unshift(savedPlace);
                    showToast('Đã thêm quán mới thành công!');
                } else {
                    localNewPlace.id = Date.now();
                    places.unshift(localNewPlace);
                    showToast('Đã thêm quán (lưu cục bộ)!');
                }
            } catch (err) {
                console.error("Lỗi khi thêm mới lên Supabase, chuyển sang lưu tạm local:", err);
                localNewPlace.id = Date.now();
                places.unshift(localNewPlace);
                markImageStateAfterLocalChange(localNewPlace);
                showToast('Lỗi Supabase khi thêm: ' + err.message, 'error');
            }

            savePlacesLocally();
            addGalleryImages = [];
            renderAddGalleryGrid();
            toggleModal(false);
            document.getElementById('addForm').reset();
            clearImage('add');
            updateFilters();
            renderPlaces();
        }


        async function proceedUpdate(updateData) {
            if (!updateData) return;
            const {
                id, name, category, district, address, image, opening_hours, price, rating,
                signature_drink, vibe, purpose, parking, amenities, ideal_for, instagram, gallery_images, latLngInput, review
            } = updateData;

            // Xử lý tọa độ GPS (hỗ trợ nhập tay)
            let lat = null;
            let lng = null;
            const coords = extractLatLng(latLngInput);
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
            }

            // Đóng gói metadata các trường mở rộng không có cột riêng trên Supabase vào trường review
            const extraData = {};
            // Luôn thêm các trường vào extraData, kể cả khi rỗng, để có thể xóa dữ liệu cũ
            extraData.price = price;
            extraData.signature_drink = signature_drink;
            extraData.vibe = vibe;
            extraData.purpose = purpose;
            extraData.parking = parking;
            extraData.amenities = amenities;
            extraData.ideal_for = ideal_for;
            extraData.instagram = instagram;

            const packedReview = packPlaceMeta(review, extraData);

            // Payload CHỈ gồm các cột CÓ THỰC trong bảng places của Supabase:
            const dbPayload = {
                name,
                category,
                district,
                address,
                opening_hours: opening_hours || null,
                rating: rating || 5,
                review: packedReview,
                lat,
                lng,
                gallery_images: gallery_images || '[]'
            };

            const fullUpdatedData = {
                name,
                category,
                district,
                address,
                image: image || null,
                opening_hours: opening_hours || null,
                rating: rating || 5,
                review: review,
                lat,
                lng,
                gallery_images: gallery_images || '[]',
                // Các trường metadata mở rộng
                price: price,
                signature_drink: signature_drink,
                vibe: vibe,
                purpose: purpose,
                parking: parking,
                amenities: amenities,
                ideal_for: ideal_for,
                instagram: instagram
            };

            // Tìm và cập nhật danh sách local ngay lập tức
            // Ghi đè hoàn toàn các trường, kể cả khi rỗng
            places = places.map(p => {
                if (String(p.id) === String(id)) {
                    return { ...p, ...fullUpdatedData };
                }
                return p;
            });
            savePlacesLocally();

            // Nếu ID là số thật (đã lưu trên Supabase), đồng bộ lên Supabase
            const isTempId = String(id).length > 10 || isNaN(Number(id));
            if (!isTempId) {
                try {
                    const { error } = await supabaseClient
                        .from('places')
                        .update(dbPayload)
                        .eq('id', id);
                    if (error) {
                        console.warn("Supabase update info:", error.message);
                        markImageStateAfterLocalChange({ id, ...fullUpdatedData });
                        showToast('Lỗi Supabase: ' + error.message, 'error');
                    } else {
                        clearLocalImageState(id);
                        showToast('Đã lưu thay đổi thành công!');
                    }
                } catch (err) {
                    console.error("Lỗi khi cập nhật lên Supabase:", err);
                    markImageStateAfterLocalChange({ id, ...fullUpdatedData });
                    showToast('Lỗi kết nối khi cập nhật (Đã lưu tạm cục bộ)', 'error');
                }
            } else {
                showToast('Đã lưu thay đổi vào bộ nhớ cục bộ!');
            }

            toggleEditModal(false); // Đóng modal chỉnh sửa
            updateFilters();
            renderPlaces();

            // Nếu đang mở modal chi tiết của quán này thì cập nhật lại luôn
            if (currentDetailPlaceId && String(currentDetailPlaceId) === String(id)) {
                openDetailModal(id);
            }
        }

