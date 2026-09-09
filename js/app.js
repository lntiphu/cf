/**
 * APP.JS - Khởi tạo ứng dụng, chế độ xem, phân trang, cuộn header, vuốt trang và render
 */

// Service Worker/manifest chỉ hoạt động trên http/https, không hoạt động khi mở trực tiếp file://.
const isHttpOrigin = window.location.protocol === 'http:' || window.location.protocol === 'https:';
const manifestLink = document.getElementById('appManifest');
if (manifestLink && isHttpOrigin) manifestLink.href = 'manifest.json';

// Đăng ký Service Worker cho PWA
if ('serviceWorker' in navigator && isHttpOrigin) {
    let isReloadingForNewServiceWorker = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isReloadingForNewServiceWorker) return;
        isReloadingForNewServiceWorker = true;
        window.location.reload();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js?v=51', { updateViaCache: 'none' })
            .then(reg => {
                reg.update();
                console.log('Service Worker đã đăng ký thành công.', reg);
            })
            .catch(async err => {
                console.log('Đăng ký Service Worker thất bại: ', err);
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.unregister()));
                    console.warn('Đã gỡ Service Worker cũ do đăng ký thất bại.');
                } catch (unregErr) {
                    console.warn('Không thể gỡ Service Worker cũ:', unregErr);
                }
            });
    });
}

// Chế độ xem & Phân trang
let viewMode = 'grid';
try {
    const savedMode = localStorage.getItem('hafu_view_mode');
    if (savedMode === 'grid' || savedMode === 'list') {
        viewMode = savedMode;
    }
} catch (e) {}
let currentPage = 1;
try {
    const savedPage = parseInt(sessionStorage.getItem('hafu_current_page'), 10);
    if (Number.isInteger(savedPage) && savedPage > 0) {
        currentPage = savedPage;
    }
} catch (e) {}
const ITEMS_PER_PAGE = 9;


        function handleSwipeStart(e) {
            // Không vuốt nếu chạm vào nút hoặc select chọn trực tiếp
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'I') return;

            swipeStartX = e.touches[0].clientX;
            isSwipingPage = true;

            const container = document.getElementById('mobilePaginationBar');
            if (container) {
                container.classList.remove('transition-all', 'duration-150');
            }
        }

        function handleSwipeMove(e) {
            if (!isSwipingPage) return;
            swipeCurrentX = e.touches[0].clientX;
            const diffX = swipeCurrentX - swipeStartX;

            // Ngăn chặn hành vi cuộn dọc mặc định của trình duyệt khi người dùng đang cố ý vuốt ngang chuyển trang
            if (Math.abs(diffX) > 8) {
                if (e.cancelable) e.preventDefault();
            }

            // Giới hạn trượt tối đa 60px để giữ thẩm mỹ
            const limitedDiff = Math.max(-60, Math.min(60, diffX));

            const container = document.getElementById('mobilePaginationBar');
            if (container) {
                container.style.transform = `translateX(${limitedDiff}px)`;
                container.style.opacity = (1 - Math.abs(limitedDiff) / 240).toString();
            }
        }

        function handleSwipeEnd(e) {
            if (!isSwipingPage) return;
            isSwipingPage = false;

            const diffX = swipeCurrentX - swipeStartX;
            const threshold = 40; // Kích hoạt chuyển trang khi vuốt quá 40px

            const container = document.getElementById('mobilePaginationBar');
            if (container) {
                container.classList.add('transition-all', 'duration-150');
                container.style.transform = '';
                container.style.opacity = '';
            }

            if (diffX > threshold) {
                // Vuốt sang PHẢI -> Sang trang sau (kế tiếp)
                const filterDistEl = document.getElementById('filterDistrict');
                const filterDist = filterDistEl ? filterDistEl.value : 'Tất cả';
                const searchQuery = getSearchQuery();
                const totalPages = Math.ceil(getFilteredPlaces().length / ITEMS_PER_PAGE);

                if (currentPage < totalPages) {
                    changePage(currentPage + 1);
                }
            } else if (diffX < -threshold) {
                // Đã tắt thao tác kéo/vuốt sang trái để back về trang trước theo yêu cầu
            }

            swipeStartX = 0;
            swipeCurrentX = 0;
        }


        function renderSkeletonCards() {
            const grid = document.getElementById('placesGrid');
            if (!grid) return;

            const count = 9; // Số skeleton card hiển thị
            grid.className = (viewMode === 'list')
                ? 'flex flex-col gap-3 w-full max-w-7xl mx-auto'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5';

            if (viewMode === 'list') {
                grid.innerHTML = Array.from({ length: count }, () => `
                    <div class="bg-white rounded-2xl overflow-hidden border border-[#EFE8DF] flex flex-row items-stretch" style="min-height:140px;">
                        <div class="w-[150px] sm:w-[180px] flex-shrink-0 skeleton-shimmer"></div>
                        <div class="px-4 py-3.5 flex-1 flex flex-col gap-2.5 justify-center">
                            <div class="skeleton-shimmer h-4 w-3/4 rounded-lg"></div>
                            <div class="skeleton-shimmer h-3 w-1/3 rounded-lg"></div>
                            <div class="skeleton-shimmer h-3 w-2/3 rounded-lg"></div>
                            <div class="flex gap-2 mt-1">
                                <div class="skeleton-shimmer h-5 w-16 rounded-full"></div>
                                <div class="skeleton-shimmer h-5 w-20 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = Array.from({ length: count }, () => `
                    <div class="bg-white rounded-2xl overflow-hidden border border-[#EFE8DF] flex flex-col">
                        <div class="skeleton-shimmer w-full" style="aspect-ratio:16/9;"></div>
                        <div class="p-4 flex flex-col gap-2.5">
                            <div class="flex items-center justify-between gap-2">
                                <div class="skeleton-shimmer h-4 flex-1 rounded-lg"></div>
                                <div class="skeleton-shimmer h-4 w-10 rounded-lg"></div>
                            </div>
                            <div class="skeleton-shimmer h-3 w-1/2 rounded-lg"></div>
                            <div class="flex gap-2 pt-2 border-t border-stone-100">
                                <div class="skeleton-shimmer h-5 w-16 rounded-full"></div>
                                <div class="skeleton-shimmer h-5 w-20 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }


        function changePage(page) {
            currentPage = Math.max(1, parseInt(page, 10) || 1);
            try { sessionStorage.setItem('hafu_current_page', String(currentPage)); } catch (e) {}

            // Cuộn lên đầu trang ngay lập tức khi bắt đầu chuyển trang
            const mainElement = document.querySelector('main');
            if (mainElement) {
                // Scroll lên đầu phần main content để user thấy skeleton loader từ trên xuống
                mainElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                // Fallback: Scroll lên đầu trang
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // Hiển thị skeleton loader trong 2 giây rồi mới hiển thị nội dung thật
            renderSkeletonCards();
            setTimeout(() => {
                renderPlaces();
                // Sau khi render xong, đảm bảo scroll position vẫn ở đầu trang
                // Đặc biệt quan trọng trên mobile khi nội dung thay đổi
                setTimeout(() => {
                    const firstCard = document.querySelector('#placesGrid > div:first-child');
                    if (firstCard) {
                        firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 100);
            }, 2000);
        }

        // Loại bỏ ký tự điều khiển/ký tự vô hình thường xuất hiện do autofill,


        function updateViewModeButtonsUI(mode) {
            const indicator = document.getElementById('viewModeIndicator');
            const btnGrid = document.getElementById('btnViewGrid');
            const btnList = document.getElementById('btnViewList');
            if (!indicator || !btnGrid || !btnList) return;

            if (mode === 'grid') {
                indicator.style.transform = 'translateX(0px)';
                btnGrid.className = "relative z-10 w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors duration-200 text-white";
                btnList.className = "relative z-10 w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors duration-200 text-stone-500 hover:text-stone-800";
            } else {
                const offset = btnList.offsetLeft - btnGrid.offsetLeft;
                indicator.style.transform = `translateX(${offset || 32}px)`;
                btnList.className = "relative z-10 w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors duration-200 text-white";
                btnGrid.className = "relative z-10 w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors duration-200 text-stone-500 hover:text-stone-800";
            }
        }

        function setViewMode(mode) {
            const grid = document.getElementById('placesGrid');

            // Nếu đang ở cùng chế độ xem thì không cần làm gì
            if (viewMode === mode) return;

            viewMode = mode;
            try { localStorage.setItem('hafu_view_mode', mode); } catch (e) {}
            updateViewModeButtonsUI(mode);

            // Chuyển đổi mượt mà, triệt tiêu giật/nhảy trang:
            if (grid) {
                // 1. Khóa tạm chiều cao hiện tại để footer/nút không bị nảy lên
                const currentHeight = grid.offsetHeight;
                if (currentHeight > 0) {
                    grid.style.minHeight = `${currentHeight}px`;
                }

                // 2. Kích hoạt hiệu ứng mờ nhẹ và thu nhỏ tinh tế
                grid.classList.add('view-switching');
                setTimeout(() => {
                    grid.classList.remove('view-switching');
                    renderPlaces();
                    // 3. Nhả khóa chiều cao sau khi các card mới đã xuất hiện mượt mà
                    setTimeout(() => {
                        grid.style.minHeight = '';
                    }, 400);
                }, 140);
            } else {
                renderPlaces();
            }
        }

        // Render Cards phong cách Cafe Maps
        function renderPlaces() {
            const result = getFilteredPlaces();
            const grid = document.getElementById('placesGrid');
            const countText = document.getElementById('placeCountText');

            // Lưu cả các lần chuyển về trang 1 do bộ lọc/tìm kiếm.
            try { sessionStorage.setItem('hafu_current_page', String(currentPage)); } catch (e) {}

            if (countText) {
                countText.innerText = `${result.length} quán được tìm thấy`;
            }

            grid.className = (viewMode === 'list') ? 'flex flex-col gap-3 w-full max-w-7xl mx-auto' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5';
            grid.innerHTML = '';

            if (result.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-16 px-4 bg-white rounded-3xl border border-stone-200/80 shadow-sm w-full">
                        <div class="w-16 h-16 rounded-full bg-amber-50 text-[#B57324] flex items-center justify-center mx-auto mb-4 text-2xl">
                            <i class="fa-solid fa-mug-hot"></i>
                        </div>
                        <h4 class="text-base font-bold text-stone-800 mb-1">Không tìm thấy quán nào phù hợp</h4>
                        <p class="text-xs sm:text-sm text-stone-500 max-w-sm mx-auto mb-4">Hãy thử tìm kiếm với từ khóa khác hoặc bấm đặt lại bộ lọc.</p>
                        <button onclick="resetAllFilters()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#B57324] text-white text-xs font-semibold hover:bg-[#9E6018] transition shadow-sm">
                            <i class="fa-solid fa-rotate-left text-xs"></i> Đặt lại bộ lọc
                        </button>
                    </div>
                `;
                return;
            }

            // Logic Phân Trang
            const totalItems = result.length;
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

            if (currentPage > totalPages && totalPages > 0) {
                currentPage = totalPages;
                try { sessionStorage.setItem('hafu_current_page', String(currentPage)); } catch (e) {}
            }

            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const paginatedResult = result.slice(startIndex, startIndex + ITEMS_PER_PAGE);

            paginatedResult.forEach(place => {
                const coverImg = getCoverImage(place);
                const openStatus = isOpenNow(place.opening_hours);
                const isFav = favoriteIds.includes(String(place.id));
                const isVisited = (window.visitedIds || visitedIds || []).includes(String(place.id));
                const price = getPlacePrice(place);
                const tags = getPlaceTags(place);
                const distKm = (isNearMeActive && userLocation) ? getPlaceDistance(place) : null;
                const distStr = formatDistance(distKm);
                const review = cleanTextField(place.review);

                let card = '';

                if (viewMode === 'list') {
                    // Chế độ xem Danh sách (List View - chuẩn tỉ lệ cafemaps.net)
                    card = `
                        <div class="place-card ${isVisited ? 'is-visited' : ''} bg-white rounded-2xl overflow-hidden border border-[#EFE8DF] flex flex-row items-stretch cursor-pointer group"
                            data-place-id="${place.id}"
                            onclick="openDetailModal('${place.id}')">
                            <!-- Ảnh bên trái: 150px × auto (gần vuông) như cafemaps -->
                            <div class="relative w-[150px] sm:w-[180px] flex-shrink-0 overflow-hidden bg-stone-100" style="min-height:140px;">
                                <img src="${coverImg}" alt="${place.name}" loading="lazy"
                                    class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                                <!-- Badge giá góc trên trái -->
                                <div class="absolute top-2 left-2 z-10">
                                    <span class="inline-flex items-center bg-black/65 backdrop-blur-md text-white font-semibold text-[10px] px-2 py-0.5 rounded-full">
                                        ${price}
                                    </span>
                                </div>
                            </div>

                            <!-- Nội dung bên phải -->
                            <div class="px-4 py-3.5 flex-1 flex flex-col justify-between min-w-0">
                                <div class="flex flex-col gap-1">
                                    <!-- Tên + Rating -->
                                    <div class="flex items-start justify-between gap-2">
                                        <h3 class="font-bold text-sm sm:text-base text-[#2D2319] group-hover:text-[#B57324] transition line-clamp-1 flex-1" title="${place.name}">
                                            ${place.name}
                                        </h3>
                                        <div class="flex items-center gap-1.5 flex-shrink-0">
                                            <span class="inline-flex items-center gap-1 text-[#B57324] font-bold text-xs">
                                                <i class="fa-solid fa-star text-amber-400 text-[11px]"></i>
                                                ${place.rating != null && place.rating !== '' ? Number(place.rating).toFixed(1) : ''}
                                            </span>
                                            <button type="button" onclick="event.stopPropagation(); toggleFavorite('${place.id}')"
                                                class="w-7 h-7 rounded-full border border-stone-200 hover:border-[#B57324] bg-white shadow-sm flex items-center justify-center transition cursor-pointer"
                                                title="${isFav ? 'Bỏ yêu thích' : 'Yêu thích'}">
                                                <i class="${isFav ? 'fa-solid fa-heart text-[#C2185B]' : 'fa-regular fa-heart text-stone-400'} text-xs"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Khu vực -->
                                    <div class="flex items-center gap-1.5 text-[11px] sm:text-xs text-stone-500 font-medium">
                                        <i class="fa-solid fa-location-dot text-[#B57324] text-[10px]"></i>
                                        <span>${place.district || 'TP.HCM'}</span>
                                        ${distStr ? `<span class="text-stone-300">·</span><span class="text-[#B57324] font-semibold">${distStr}</span>` : ''}
                                    </div>

                                    <!-- Mô tả / Ghi chú (1 dòng) -->
                                    ${review ? `<p class="text-[11px] sm:text-xs text-stone-500 line-clamp-1 mt-0.5 italic font-medium">“${review}”</p>` : ''}
                                </div>

                                <!-- Tags + Trạng thái mở cửa -->
                                <div class="flex items-center gap-1.5 flex-wrap mt-2">
                                    ${tags.slice(0, 2).map(t => `<span class="bg-[#FAF4EE] text-[#8C5228] text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">${t}</span>`).join('')}
                                    ${openStatus === true ? `
                                        <span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-medium text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                                            <span class="relative flex h-1.5 w-1.5"><span class="status-dot-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>
                                            Đang mở cửa
                                        </span>
                                    ` : openStatus === false ? `
                                        <span class="inline-flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-200/60 font-medium text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                                            <span class="relative flex h-1.5 w-1.5"><span class="status-dot-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span></span>
                                            Đóng cửa
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Chế độ xem Lưới (Grid View - ảnh 16:9 chuẩn cafemaps.net)
                    card = `
                        <div class="place-card ${isVisited ? 'is-visited' : ''} bg-white rounded-2xl overflow-hidden border border-[#EFE8DF] flex flex-col group cursor-pointer"
                            data-place-id="${place.id}"
                            onclick="openDetailModal('${place.id}')" title="Bấm để xem chi tiết quán">

                            <!-- Ảnh tỉ lệ 16:9 (aspect-video) như cafemaps -->
                            <div class="relative w-full overflow-hidden bg-stone-100" style="aspect-ratio:16/9;">
                                <img src="${coverImg}" alt="${place.name}" loading="lazy"
                                    class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none"></div>

                                <!-- Badge giá góc trên trái -->
                                <div class="absolute top-2.5 left-2.5 z-10">
                                    <span class="inline-flex items-center bg-black/60 backdrop-blur-md text-white font-semibold text-[11px] px-2.5 py-0.5 rounded-full">
                                        ${price}
                                    </span>
                                </div>

                                <!-- Nút yêu thích góc trên phải -->
                                <button onclick="event.stopPropagation(); toggleFavorite('${place.id}')"
                                    class="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/85 hover:bg-white backdrop-blur-sm shadow-sm flex items-center justify-center transition cursor-pointer z-10"
                                    title="Yêu thích">
                                    <i class="transition ${isFav ? 'fa-solid fa-heart text-[#C2185B]' : 'fa-regular fa-heart text-stone-500 hover:text-[#C2185B]'} text-sm"></i>
                                </button>

                                <!-- Dòng cảm nhận ngắn ở dưới ảnh: Mặc định ẩn, chỉ hiện khi rê chuột vào quán -->
                                ${review ? `
                                    <div class="card-review-overlay absolute bottom-0 inset-x-0 px-3.5 pt-8 pb-2.5 bg-gradient-to-t from-black/95 via-black/55 to-transparent z-10 pointer-events-none">
                                        <p class="card-review-quote text-[12.5px] sm:text-[13px] leading-snug line-clamp-1 truncate" title="${review}">
                                            “${review}”
                                        </p>
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Nội dung card (bên dưới ảnh) -->
                            <div class="p-3.5 sm:p-4 flex flex-col gap-2">
                                <!-- Tên + Rating -->
                                <div class="flex items-start justify-between gap-2">
                                    <h3 class="font-bold text-sm sm:text-base text-[#2D2319] group-hover:text-[#B57324] transition line-clamp-1 flex-1" title="${place.name}">
                                        ${place.name}
                                    </h3>
                                    <span class="inline-flex items-center gap-1 text-[#B57324] font-bold text-xs flex-shrink-0">
                                        <i class="fa-solid fa-star text-amber-400 text-[11px]"></i>
                                        ${place.rating != null && place.rating !== '' ? Number(place.rating).toFixed(1) : ''}
                                    </span>
                                </div>

                                <!-- Trạng thái mở cửa + Khu vực -->
                                <div class="flex items-center gap-1.5 text-xs text-stone-500">
                                    ${openStatus === true ? `
                                        <span class="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                                            <span class="relative flex h-2 w-2 flex-shrink-0"><span class="status-dot-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                                            Đang mở
                                        </span>
                                        <span class="text-stone-300">·</span>
                                    ` : openStatus === false ? `
                                        <span class="inline-flex items-center gap-1.5 text-rose-500 font-semibold text-xs">
                                            <span class="relative flex h-2 w-2 flex-shrink-0"><span class="status-dot-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span></span>
                                            Đóng cửa
                                        </span>
                                        <span class="text-stone-300">·</span>
                                    ` : ''}
                                    <span class="flex items-center gap-1 truncate">
                                        <i class="fa-solid fa-location-dot text-[#B57324] text-[11px] flex-shrink-0"></i>
                                        <span class="truncate">${place.district || 'TP.HCM'}</span>
                                    </span>
                                    ${distStr ? `<span class="text-stone-300">·</span><span class="text-[#B57324] font-semibold text-[11px] whitespace-nowrap">${distStr}</span>` : ''}
                                </div>

                                <!-- Tags -->
                                <div class="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-100">
                                    ${tags.slice(0, 3).map((t, i) => `
                                        <span class="${i === 0 ? 'bg-[#FAF0E6] text-[#8C5228] font-semibold' : 'bg-[#F6F2EE] text-stone-500 font-medium'} text-[11px] px-2.5 py-0.5 rounded-full whitespace-nowrap">${t}</span>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }

                grid.innerHTML += card;
            });

            // Áp dụng hiệu ứng xuất hiện mượt mà, nịnh mắt cho từng card
            const cards = grid.querySelectorAll('.place-card');
            cards.forEach((el, i) => {
                el.classList.add('card-enter');
                el.style.animationDelay = `${Math.min(i * 35, 240)}ms`;
                el.addEventListener('animationend', () => {
                    el.classList.remove('card-enter');
                    el.style.animationDelay = '';
                }, { once: true });
            });

            // Pagination Rendering
            if (totalPages > 1) {
                let mobilePaginationHTML = `
                    <div id="mobilePaginationBar"
                        ontouchstart="handleSwipeStart(event)"
                        ontouchmove="handleSwipeMove(event)"
                        ontouchend="handleSwipeEnd(event)"
                        class="col-span-full flex sm:hidden justify-between items-center gap-4 mt-8 mb-3 px-4 w-full bg-white/90 backdrop-blur-md rounded-2xl py-3 border border-stone-200 shadow-sm transition-all duration-150">
                        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}
                            class="w-10 h-10 rounded-full bg-stone-50 hover:bg-stone-100 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center flex-shrink-0 shadow-sm border border-stone-200">
                            <i class="fa-solid fa-chevron-left text-sm"></i>
                        </button>

                        <div id="pageSwipeContainer" class="flex-1 flex flex-col items-center gap-1.5 px-2 select-none">
                            <div class="relative flex items-center justify-center bg-amber-50 px-3 py-1 rounded-full border border-amber-200 shadow-sm cursor-pointer">
                                <select onchange="changePage(parseInt(this.value))"
                                    class="bg-transparent text-xs font-bold tracking-wider text-[#B57324] focus:outline-none cursor-pointer appearance-none text-center pr-3.5 leading-none">
                                    ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                                        <option value="${p}" ${p === currentPage ? 'selected' : ''}>Trang ${p} / ${totalPages}</option>
                                    `).join('')}
                                </select>
                                <i class="fa-solid fa-chevron-down text-[9px] text-[#B57324] pointer-events-none absolute right-2.5"></i>
                            </div>
                            <div class="w-28 h-1.5 bg-stone-200 rounded-full overflow-hidden relative mx-auto">
                                <div class="h-full bg-gradient-to-r from-amber-500 to-[#B57324] rounded-full transition-all duration-300" style="width: ${(currentPage / totalPages) * 100}%"></div>
                            </div>
                        </div>

                        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}
                            class="w-10 h-10 rounded-full bg-stone-50 hover:bg-stone-100 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center flex-shrink-0 shadow-sm border border-stone-200">
                            <i class="fa-solid fa-chevron-right text-sm"></i>
                        </button>
                    </div>
                `;

                let desktopPaginationHTML = `
                    <div class="col-span-full hidden sm:flex justify-center items-center gap-2 mt-8 mb-4">
                        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}
                            class="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:border-[#B57324] hover:text-[#B57324] disabled:opacity-40 disabled:cursor-not-allowed transition duration-200 text-sm font-semibold flex items-center gap-1 shadow-sm">
                            <i class="fa-solid fa-chevron-left text-xs"></i> Trước
                        </button>
                `;

                const range = [];
                const delta = 2;
                const left = currentPage - delta;
                const right = currentPage + delta + 1;
                let l;

                for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= left && i < right)) {
                        range.push(i);
                    }
                }

                for (let i of range) {
                    if (l) {
                        if (i - l === 2) {
                            desktopPaginationHTML += `<span class="px-2 text-stone-400 font-semibold select-none">...</span>`;
                        } else if (i - l > 2) {
                            desktopPaginationHTML += `<span class="px-2 text-stone-400 font-semibold select-none">...</span>`;
                        }
                    }
                    const isActive = i === currentPage;
                    desktopPaginationHTML += `
                        <button onclick="changePage(${i})"
                            class="w-10 h-10 rounded-xl transition duration-200 text-sm font-bold shadow-sm ${isActive ? 'bg-[#B57324] text-white' : 'bg-white border border-stone-200 text-stone-700 hover:border-[#B57324] hover:text-[#B57324]'}">
                            ${i}
                        </button>
                    `;
                    l = i;
                }

                desktopPaginationHTML += `
                        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}
                            class="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:border-[#B57324] hover:text-[#B57324] disabled:opacity-40 disabled:cursor-not-allowed transition duration-200 text-sm font-semibold flex items-center gap-1 shadow-sm">
                            Sau <i class="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                `;

                grid.innerHTML += mobilePaginationHTML + desktopPaginationHTML;
            }
        }

        // Xử lý cơ chế kéo để reload (Pull-to-refresh) cho Mobile Standalone
        let touchStart = 0;
        let touchDecel = 0;
        const ptrIndicator = document.getElementById('pullToRefreshIndicator');
        const ptrText = document.getElementById('pullToRefreshText');

        window.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                touchStart = e.touches[0].clientY;
            } else {
                touchStart = 0;
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (touchStart === 0) return;
            const currentY = e.touches[0].clientY;
            const distance = currentY - touchStart;

            if (distance > 0 && distance < 180) {
                ptrIndicator.style.height = `${distance}px`;
                ptrIndicator.style.paddingTop = '0.75rem';
                ptrIndicator.style.paddingBottom = '0.75rem';
                ptrIndicator.style.borderBottomWidth = '1px';
                ptrIndicator.style.opacity = `${distance / 180}`;
                if (distance > 100) {
                    ptrText.innerText = "Thả tay để làm mới dữ liệu...";
                } else {
                    ptrText.innerText = "Kéo để làm mới...";
                }
            }
        });

        window.addEventListener('touchend', async (e) => {
            if (touchStart === 0) return;
            const currentY = e.changedTouches[0].clientY;
            const distance = currentY - touchStart;

            if (distance > 100) {
                ptrText.innerText = "Đang cập nhật từ Supabase...";
                ptrIndicator.style.height = '50px';
                ptrIndicator.style.paddingTop = '0.75rem';
                ptrIndicator.style.paddingBottom = '0.75rem';
                ptrIndicator.style.borderBottomWidth = '1px';
                await loadPlaces();
            }

            // Đóng indicator sau khi load xong hoặc hủy kéo
            setTimeout(() => {
                ptrIndicator.style.height = '0px';
                ptrIndicator.style.paddingTop = '0px';
                ptrIndicator.style.paddingBottom = '0px';
                ptrIndicator.style.borderBottomWidth = '0px';
                ptrIndicator.style.opacity = '0';
            }, 600);

            touchStart = 0;
        });

        // Thanh Header cố định chuẩn Cafe Maps (Giữ nguyên kích thước và vị trí cố định)

        // Bảo vệ ô tìm kiếm: triệt tiêu hoàn toàn autofill mã Base64 hoặc token từ Chrome trên di động
        const searchInputEl = document.getElementById('inputSearch');
        if (searchInputEl) {
            // Ngăn chặn dán chuỗi Base64 hoặc token vào ô tìm kiếm
            searchInputEl.addEventListener('paste', function(e) {
                const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
                if (isBase64OrToken(pasted)) {
                    e.preventDefault();
                    this.value = '';
                    clearSearch();
                }
            });

            // Khi người dùng chạm/focus vào ô tìm kiếm
            searchInputEl.addEventListener('focus', function() {
                this.removeAttribute('readonly');
                if (isBase64OrToken(this.value)) {
                    this.value = '';
                    clearSearch();
                }
            });

            // Khi rời khỏi ô tìm kiếm và nếu ô trống, kích hoạt lại readonly để chặn Chrome autofill
            searchInputEl.addEventListener('blur', function() {
                if (!this.value) {
                    this.setAttribute('readonly', 'readonly');
                }
            });
        }

        // Đảm bảo khi tải trang hoặc quay lại từ back/forward cache (bfcache) của Chrome, ô tìm kiếm luôn sạch
        ['DOMContentLoaded', 'pageshow', 'load'].forEach(evt => {
            window.addEventListener(evt, () => {
                const input = document.getElementById('inputSearch');
                if (input) {
                    if (isBase64OrToken(input.value)) {
                        input.value = '';
                    }
                    input.setAttribute('readonly', 'readonly');
                }
            });
        });


        // Hàm kiểm tra hash URL và mở modal tương ứng
        function checkHashAndOpenModal() {
            const hash = window.location.hash;
            const hashValue = hash.substring(1);
            
            // Nếu không có hash => Đóng tất cả modal nếu đang mở
            if (!hash || hashValue === '') {
                const detailModal = document.getElementById('placeDetailModal');
                if (detailModal && !detailModal.classList.contains('hidden')) {
                    closeDetailModal();
                }
                const galleryModal = document.getElementById('fullGalleryModal');
                if (galleryModal && !galleryModal.classList.contains('hidden')) {
                    closeFullGalleryModal();
                }
                return;
            }
            
            // Hash chỉ chứa số (ID quán) => Mở modal chi tiết
            if (/^\d+$/.test(hashValue)) {
                const id = parseInt(hashValue);
                if (id && places.length > 0) {
                    // Đợi một chút để đảm bảo places đã được load
                    setTimeout(() => {
                        const place = places.find(p => String(p.id) === String(id));
                        if (place) {
                            openDetailModal(id);
                        }
                    }, 100);
                }
            }
            // Hash là 'gallery' => Mở modal gallery (nếu đang xem chi tiết quán nào đó)
            else if (hashValue === 'gallery' && currentDetailPlaceId) {
                setTimeout(() => {
                    openFullGalleryModal();
                }, 100);
            }
        }

        // Hàm khởi tạo sau khi load places
        async function initializeApp() {
            updateViewModeButtonsUI(viewMode);
            await loadPlaces();
            checkHashAndOpenModal();
            
            // Thêm listener cho sự kiện hashchange (khi user thay đổi URL hash)
            window.addEventListener('hashchange', checkHashAndOpenModal);
        }

        // Khởi chạy khi tải trang
        initializeApp();
