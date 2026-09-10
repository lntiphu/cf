/**
 * FILTERS.JS - Bộ lọc tìm kiếm, quận huyện, yêu thích, sắp xếp và drawer
 */

let showOnlyFavorites = false;
let showOnlyOpenNow = false;
let selectedCategory = 'Tất cả';
let selectedMood = '';
let selectedPurpose = '';
let selectedAmenity = '';
let selectedPrice = '';
let sortBy = 'default';

        // Quản lý trạng thái Yêu thích, Đã đi và Modal Chi Tiết.
            // Gộp dữ liệu yêu thích cũ vào danh sách mới để không làm mất lựa chọn trước đây.
        let favoriteIds = (() => {
            try {
                const oldFavorites = JSON.parse(localStorage.getItem('favoriteIds') || '[]');
                const oldLegacyFavorites = JSON.parse(localStorage.getItem('votedIds') || '[]');
                const mergedFavorites = [...new Set([...(Array.isArray(oldFavorites) ? oldFavorites : []), ...(Array.isArray(oldLegacyFavorites) ? oldLegacyFavorites : [])])]
                    .map(id => String(id));
                localStorage.setItem('favoriteIds', JSON.stringify(mergedFavorites));
                localStorage.removeItem('votedIds');
                return mergedFavorites;
            } catch (err) {
                return [];
            }
        })();
        let visitedIds = (JSON.parse(localStorage.getItem('visitedIds')) || []).map(id => String(id));
        window.visitedIds = visitedIds;


        function getSearchQuery() {
            const input = document.getElementById('inputSearch');
            const raw = input ? input.value : '';
            // Nếu vô tình chứa mã base64 hoặc token, xóa sạch ngay lập tức
            if (isBase64OrToken(raw)) {
                if (input) input.value = '';
                return '';
            }
            return normalizeSearchText(raw);
        }

        function handleSearchInput(event) {
            const input = (event && event.currentTarget) ? event.currentTarget : document.getElementById('inputSearch');
            if (!input) return;

            // Chặn đứng hoàn toàn bất kỳ chuỗi base64 hoặc token nào bị autofill hoặc dán vào ô tìm kiếm
            if (isBase64OrToken(input.value)) {
                input.value = '';
                clearSearch();
                return;
            }

            // Giới hạn độ dài tối đa 100 ký tự mà KHÔNG được trim để người dùng thoải mái gõ khoảng trắng (Space) giữa các từ
            if (!event || !event.isComposing) {
                if (input.value.length > 100) {
                    input.value = input.value.slice(0, 100);
                }
            }
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) {
                if (input.value.trim().length > 0) {
                    btnClear.classList.remove('hidden');
                } else {
                    btnClear.classList.add('hidden');
                }
            }
            handleFilterChange();
        }

        function clearSearch() {
            const input = document.getElementById('inputSearch');
            if (input) {
                input.value = '';
                input.setAttribute('readonly', 'readonly');
            }
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) btnClear.classList.add('hidden');
            handleFilterChange();
        }

        function handleFilterChange() {
            currentPage = 1;
            renderPlaces();
        }

        function handleDistrictFilterChange() {
            updateDistrictPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        function selectDistrictFilter(dist) {
            const districtSelect = document.getElementById('filterDistrict');
            const currentDist = districtSelect ? districtSelect.value : 'Tất cả';
            const newDist = (currentDist === dist && dist !== 'Tất cả') ? 'Tất cả' : dist;
            if (districtSelect) districtSelect.value = newDist;
            updateDistrictPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        function updateDistrictPillsUI() {
            const districtSelect = document.getElementById('filterDistrict');
            const currentDist = districtSelect ? districtSelect.value : 'Tất cả';
            const distPills = document.querySelectorAll('.dynamic-dist-pill');
            distPills.forEach(btn => {
                const d = btn.getAttribute('data-district');
                if (d === currentDist) {
                    btn.className = "dynamic-dist-pill filter-pill active px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-[#B57324] text-white shadow-sm border border-[#B57324] flex-shrink-0";
                } else {
                    btn.className = "dynamic-dist-pill filter-pill px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-white text-stone-700 border border-stone-200 shadow-sm hover:border-[#B57324] transition flex-shrink-0";
                }
            });
        }

        function updateBtnToggleDrawerUI() {
            const drawer = document.getElementById('filterDrawer');
            const btn = document.getElementById('btnToggleDrawer');
            const dot = document.getElementById('drawerActiveDot');
            const districtSelect = document.getElementById('filterDistrict');
            const distVal = districtSelect ? districtSelect.value : 'Tất cả';
            const hasActiveDrawerFilters = (selectedCategory !== 'Tất cả' || distVal !== 'Tất cả' || Boolean(selectedMood) || Boolean(selectedPurpose) || Boolean(selectedAmenity) || Boolean(selectedPrice));
            
            if (dot) {
                if (hasActiveDrawerFilters) {
                    dot.classList.remove('hidden');
                } else {
                    dot.classList.add('hidden');
                }
            }

            const isOpen = drawer && !drawer.classList.contains('hidden');
            if (btn) {
                if (isOpen) {
                    btn.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold border border-[#B57324] bg-[#FAF0E6] text-[#B57324] whitespace-nowrap transition flex-shrink-0 shadow-sm";
                } else if (hasActiveDrawerFilters) {
                    btn.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold border border-[#B57324] bg-[#FAF0E6] text-[#B57324] whitespace-nowrap transition flex-shrink-0 shadow-sm";
                } else {
                    btn.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold border border-[#E6DDD2] bg-[#FAF7F2] text-stone-700 whitespace-nowrap hover:bg-[#F3EDE6] transition flex-shrink-0";
                }
            }
        }

        function handleSortChange(val) {
            sortBy = val;
            if (val === 'distance') {
                if (!userLocation) {
                    toggleNearMeFilter();
                    return;
                } else {
                    isNearMeActive = true;
                    updateFilterPillsUI();
                }
            } else {
                if (isNearMeActive) {
                    isNearMeActive = false;
                    updateFilterPillsUI();
                }
            }
            currentPage = 1;
            renderPlaces();
        }


        function toggleFilterDrawer(forceState) {
            const drawer = document.getElementById('filterDrawer');
            const backdrop = document.getElementById('filterDrawerBackdrop');
            const chevron = document.getElementById('drawerChevron');
            if (!drawer) return;

            const shouldOpen = (typeof forceState === 'boolean') 
                ? forceState 
                : drawer.classList.contains('hidden');

            if (shouldOpen) {
                drawer.classList.remove('hidden');
                if (backdrop) backdrop.classList.remove('hidden');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
                updateBtnToggleDrawerUI();
            } else {
                drawer.classList.add('hidden');
                if (backdrop) backdrop.classList.add('hidden');
                if (chevron) chevron.style.transform = '';
                updateBtnToggleDrawerUI();
            }
        }

        function applyFiltersAndClose() {
            toggleFilterDrawer(false);
            currentPage = 1;
            renderPlaces();
        }

        function selectMoodFilter(mood) {
            selectedMood = (selectedMood === mood) ? '' : mood;
            updateDrawerPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        function selectPurposeFilter(purpose) {
            selectedPurpose = (selectedPurpose === purpose) ? '' : purpose;
            updateDrawerPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        function selectAmenityFilter(amenity) {
            selectedAmenity = (selectedAmenity === amenity) ? '' : amenity;
            updateDrawerPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        function selectPriceFilter(price) {
            selectedPrice = (selectedPrice === price) ? '' : price;
            updateDrawerPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        function resetAllFilters() {
            selectedCategory = 'Tất cả';
            showOnlyOpenNow = false;
            showOnlyFavorites = false;
            isNearMeActive = false;
            selectedMood = '';
            selectedPurpose = '';
            selectedAmenity = '';
            selectedPrice = '';
            const sortSelect = document.getElementById('sortBy');
            if (sortSelect && sortSelect.value === 'distance') {
                sortSelect.value = 'default';
                sortBy = 'default';
            }
            const dist = document.getElementById('filterDistrict');
            if (dist) dist.value = 'Tất cả';
            const input = document.getElementById('inputSearch');
            if (input) input.value = '';
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) btnClear.classList.add('hidden');
            updateDrawerPillsUI();
            updateFilterPillsUI();
            updateDistrictPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        function updateDrawerPillsUI() {
            // Mood pills inside popup
            const moodPills = document.querySelectorAll('.mood-pill');
            moodPills.forEach(p => {
                const text = p.innerText.trim();
                if (selectedMood && text.includes(selectedMood)) {
                    p.className = "mood-pill active px-3 py-1.5 rounded-full text-xs font-semibold border border-[#B57324] bg-[#B57324] text-white shadow-sm transition";
                } else {
                    p.className = "mood-pill px-3 py-1.5 rounded-full text-xs font-semibold border border-stone-200 bg-white text-stone-700 hover:border-[#B57324] transition shadow-sm";
                }
            });

            // Purpose pills
            const purposePills = document.querySelectorAll('.purpose-pill');
            purposePills.forEach(p => {
                const text = p.innerText.trim();
                if (selectedPurpose && text.includes(selectedPurpose)) {
                    p.className = "purpose-pill active px-3 py-1.5 rounded-full text-xs font-semibold border border-[#B57324] bg-[#B57324] text-white shadow-sm transition";
                } else {
                    p.className = "purpose-pill px-3 py-1.5 rounded-full text-xs font-semibold border border-stone-200 bg-white text-stone-700 hover:border-[#B57324] transition shadow-sm";
                }
            });

            // Amenity pills
            const amenityPills = document.querySelectorAll('.amenity-pill');
            amenityPills.forEach(p => {
                const text = p.innerText.trim();
                if (selectedAmenity && text.includes(selectedAmenity)) {
                    p.className = "amenity-pill active px-3 py-1.5 rounded-full text-xs font-semibold border border-[#B57324] bg-[#B57324] text-white shadow-sm transition";
                } else {
                    p.className = "amenity-pill px-3 py-1.5 rounded-full text-xs font-semibold border border-stone-200 bg-white text-stone-700 hover:border-[#B57324] transition shadow-sm";
                }
            });

            // Price pills
            const pricePills = document.querySelectorAll('.price-pill');
            pricePills.forEach(p => {
                const text = p.innerText.trim();
                if (selectedPrice && text.includes(selectedPrice)) {
                    p.className = "price-pill active px-3 py-1.5 rounded-full text-xs font-semibold border border-[#B57324] bg-[#B57324] text-white shadow-sm transition";
                } else {
                    p.className = "price-pill px-3 py-1.5 rounded-full text-xs font-semibold border border-stone-200 bg-white text-stone-700 hover:border-[#B57324] transition shadow-sm";
                }
            });
        }

        // Chuyển đổi bộ lọc yêu thích
        function toggleFavFilter() {
            showOnlyFavorites = !showOnlyFavorites;
            updateFilterPillsUI();
            currentPage = 1;
            renderPlaces();
        }

        // Chuyển đổi bộ lọc đang mở cửa
        function toggleOpenNowFilter() {
            showOnlyOpenNow = !showOnlyOpenNow;
            updateFilterPillsUI();
            currentPage = 1;
            renderPlaces();
        }

        // Chọn danh mục theo pill
        function selectCategoryFilter(cat) {
            selectedCategory = (selectedCategory === cat && cat !== 'Tất cả') ? 'Tất cả' : cat;
            const selectEl = document.getElementById('filterCategory');
            if (selectEl) selectEl.value = selectedCategory;
            updateFilterPillsUI();
            updateBtnToggleDrawerUI();
            currentPage = 1;
            renderPlaces();
        }

        // Điều hướng nhanh trên mobile bottom nav & top navbar
        function setFilterNav(tab) {
            if (tab === 'all') {
                showOnlyFavorites = false;
                showOnlyOpenNow = false;
                selectedCategory = 'Tất cả';
                selectedMood = '';
                selectedPurpose = '';
                const dist = document.getElementById('filterDistrict');
                if (dist) dist.value = 'Tất cả';
                updateDistrictPillsUI();
                updateDrawerPillsUI();
                updateBtnToggleDrawerUI();
            } else if (tab === 'open') {
                showOnlyOpenNow = true;
                showOnlyFavorites = false;
            } else if (tab === 'fav') {
                showOnlyFavorites = true;
                showOnlyOpenNow = false;
            }
            updateFilterPillsUI();
            currentPage = 1;
            renderPlaces();
        }

        function updateFilterPillsUI() {
            // Pill Đang mở
            const pillOpen = document.getElementById('pillFilterOpen');
            if (pillOpen) {
                if (showOnlyOpenNow) {
                    pillOpen.className = "filter-pill active px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-[#B57324] text-white shadow-sm border border-[#B57324] flex items-center gap-1.5 flex-shrink-0";
                } else {
                    pillOpen.className = "filter-pill px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-white text-stone-700 border border-stone-200 shadow-sm flex items-center gap-1.5 hover:border-[#B57324] transition flex-shrink-0";
                }
            }

            // Pill Yêu thích
            const pillFav = document.getElementById('pillFilterFav');
            if (pillFav) {
                if (showOnlyFavorites) {
                    pillFav.className = "filter-pill active px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-[#B57324] text-white shadow-sm border border-[#B57324] flex items-center gap-1.5 flex-shrink-0";
                } else {
                    pillFav.className = "filter-pill px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-white text-stone-700 border border-stone-200 shadow-sm flex items-center gap-1.5 hover:border-[#B57324] transition flex-shrink-0";
                }
            }

            // Pill Gần tôi
            const pillNearMe = document.getElementById('pillFilterNearMe');
            const iconNearMe = document.getElementById('nearMeIcon');
            if (pillNearMe) {
                if (isNearMeActive) {
                    pillNearMe.className = "filter-pill active px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-[#B57324] text-white shadow-sm border border-[#B57324] flex items-center gap-1.5 flex-shrink-0 cursor-pointer";
                    if (iconNearMe) iconNearMe.className = "fa-solid fa-location-crosshairs text-xs text-white";
                } else {
                    pillNearMe.className = "filter-pill px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-white text-stone-700 border border-stone-200 shadow-sm flex items-center gap-1.5 hover:border-[#B57324] transition flex-shrink-0 cursor-pointer";
                    if (iconNearMe) iconNearMe.className = "fa-solid fa-location-crosshairs text-xs text-[#B57324]";
                }
            }

            // Dynamic Category Pills
            const catPills = document.querySelectorAll('.dynamic-cat-pill');
            catPills.forEach(btn => {
                const catName = btn.getAttribute('data-category');
                if (catName === selectedCategory) {
                    btn.className = "dynamic-cat-pill filter-pill active px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-[#B57324] text-white shadow-sm border border-[#B57324] flex-shrink-0";
                } else {
                    btn.className = "dynamic-cat-pill filter-pill px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-white text-stone-700 border border-stone-200 shadow-sm hover:border-[#B57324] transition flex-shrink-0";
                }
            });
        }

        // Cấu hình 9 quán đặc biệt ưu tiên hiển thị ở trang đầu khi chưa lọc
        const FEATURED_PRIORITY_IDS = [17, 102, 87, 56, 55, 47, 23, 13, 10];
        const FEATURED_PATTERNS = [
            { id: 17, match: (n) => n.startsWith('o ho') || n.includes('o ho coffee') },
            { id: 102, match: (n) => n.startsWith('keng') },
            { id: 87, match: (n) => n.includes('el.saigon') || n.includes('el saigon') },
            { id: 56, match: (n) => n.includes('comfy') && n.includes('tu xuong') },
            { id: 55, match: (n) => n.startsWith('tron ca phe') || n.startsWith('tron cafe') },
            { id: 47, match: (n) => n.startsWith('cung.cafe') || n.startsWith('cung cafe') },
            { id: 23, match: (n) => n.startsWith('mua ca phe') || n.startsWith('mua cafe') },
            { id: 13, match: (n) => n.includes('16 gram') },
            { id: 10, match: (n) => n.startsWith('phuong ca phe') || n.startsWith('phuong cafe') }
        ];

        function getFeaturedPriorityIndex(place) {
            if (!place) return -1;
            const pId = Number(place.id);
            const idIdx = FEATURED_PRIORITY_IDS.indexOf(pId);
            if (idIdx !== -1) return idIdx;

            const normName = normalizeSearchText(place.name || '');
            for (let i = 0; i < FEATURED_PATTERNS.length; i++) {
                if (FEATURED_PATTERNS[i].match(normName)) {
                    return i;
                }
            }
            return -1;
        }

        function getFilteredPlaces() {
            const filterDistEl = document.getElementById('filterDistrict');
            const filterDist = filterDistEl ? filterDistEl.value : 'Tất cả';
            const searchQuery = getSearchQuery();

            let list = places.filter(p => {
                const matchCat = selectedCategory === 'Tất cả' || p.category === selectedCategory;
                const matchDist = filterDist === 'Tất cả' || p.district === filterDist;
                // Lọc theo Mood & Purpose & Amenity & Price
                const tags = getPlaceTags(p);
                const tagStr = tags.join(' ');
                const cleanRev = cleanTextField(p.review || '');
                const matchSearch = !searchQuery ||
                                    normalizeSearchText(p.name).includes(searchQuery) ||
                                    normalizeSearchText(p.address || '').includes(searchQuery) ||
                                    normalizeSearchText(p.district || '').includes(searchQuery) ||
                                    normalizeSearchText(p.category || '').includes(searchQuery) ||
                                    normalizeSearchText(tagStr).includes(searchQuery) ||
                                    (p.vibe && normalizeSearchText(p.vibe).includes(searchQuery)) ||
                                    (p.purpose && normalizeSearchText(p.purpose).includes(searchQuery)) ||
                                    (cleanRev && normalizeSearchText(cleanRev).includes(searchQuery));
                const matchFav = !showOnlyFavorites || favoriteIds.includes(String(p.id));
                const matchOpen = !showOnlyOpenNow || isOpenNow(p.opening_hours) === true;
                const matchMood = !selectedMood || tags.some(t => normalizeSearchText(t).includes(normalizeSearchText(selectedMood))) || (p.vibe && normalizeSearchText(p.vibe).includes(normalizeSearchText(selectedMood))) || (cleanRev && cleanRev.includes(selectedMood));
                const matchPurpose = !selectedPurpose || (p.purpose && normalizeSearchText(p.purpose).includes(normalizeSearchText(selectedPurpose))) || tags.some(t => normalizeSearchText(t).includes(normalizeSearchText(selectedPurpose))) || (cleanRev && cleanRev.includes(selectedPurpose));
                const matchAmenity = !selectedAmenity || matchesAmenity(p, selectedAmenity);
                const matchPrice = !selectedPrice || matchesPrice(getPlacePrice(p), selectedPrice);

                return matchCat && matchDist && matchSearch && matchFav && matchOpen && matchMood && matchPurpose && matchAmenity && matchPrice;
            });

            // Danh sách 9 quán ưu tiên hiển thị ở trang đầu khi chưa chọn bộ lọc nào
            const isNoFilter = !searchQuery &&
                selectedCategory === 'Tất cả' &&
                filterDist === 'Tất cả' &&
                !showOnlyFavorites &&
                !showOnlyOpenNow &&
                !selectedMood &&
                !selectedPurpose &&
                !selectedAmenity &&
                !selectedPrice;

            // Sắp xếp
            if (isNearMeActive || sortBy === 'distance') {
                list.sort((a, b) => {
                    const distA = getPlaceDistance(a) ?? 999999;
                    const distB = getPlaceDistance(b) ?? 999999;
                    return distA - distB;
                });
            } else if (sortBy === 'rating') {
                list.sort((a, b) => (b.rating || 5) - (a.rating || 5));
            } else if (sortBy === 'name') {
                list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
            } else if (isNoFilter) {
                // Mặc định khi chưa có bộ lọc gì: Đưa đúng 9 quán ưu tiên lên trang đầu theo thứ tự
                list.sort((a, b) => {
                    const prioA = getFeaturedPriorityIndex(a);
                    const prioB = getFeaturedPriorityIndex(b);
                    const isFeaturedA = prioA !== -1;
                    const isFeaturedB = prioB !== -1;

                    if (isFeaturedA && isFeaturedB) return prioA - prioB;
                    if (isFeaturedA) return -1;
                    if (isFeaturedB) return 1;

                    return (Number(b.id) || 0) - (Number(a.id) || 0);
                });
            } else {
                // Mặc định khi đã chọn bộ lọc: theo ID mới nhất
                list.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
            }

            return list;
        }

        // Bật/Tắt Trạng thái Yêu thích (So sánh chuỗi an toàn tuyệt đối)
        async function toggleFavorite(id) {
            if (!id) return;
            const idStr = String(id);
            if (favoriteIds.includes(idStr)) {
                favoriteIds = favoriteIds.filter(favId => favId !== idStr);
            } else {
                favoriteIds.push(idStr);
            }
            localStorage.setItem('favoriteIds', JSON.stringify(favoriteIds));
            renderPlaces();
            const place = places.find(p => String(p.id) === idStr);
            if (place && typeof saveSharedPlaceStatus === 'function') {
                await saveSharedPlaceStatus(idStr, favoriteIds.includes(idStr), visitedIds.includes(idStr));
            }
        }


        // Hàm cập nhật Option cho Filter tự động
        function updateFilters() {
            const districtSelect = document.getElementById('filterDistrict');
            const currentDist = districtSelect ? districtSelect.value : 'Tất cả';

            const categories = [...new Set(places.map(p => p.category).filter(Boolean))];
            const districts = ['Tất cả', ...new Set(places.map(p => p.district).filter(Boolean))];

            // Render dynamic category pills
            const dynamicContainer = document.getElementById('dynamicCategoryPills');
            if (dynamicContainer) {
                dynamicContainer.innerHTML = categories.map(cat => `
                    <button data-category="${cat}" onclick="selectCategoryFilter('${cat}')"
                        class="dynamic-cat-pill filter-pill px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-white text-stone-700 border border-stone-200 shadow-sm ${cat === selectedCategory ? 'active bg-[#B57324] text-white border-[#B57324]' : ''}">
                        ${cat}
                    </button>
                `).join('');
            }

            // Render dynamic district pills
            const dynamicDistContainer = document.getElementById('dynamicDistrictPills');
            if (dynamicDistContainer) {
                dynamicDistContainer.innerHTML = districts.map(d => `
                    <button data-district="${d}" onclick="selectDistrictFilter('${d}')"
                        class="dynamic-dist-pill filter-pill px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-white text-stone-700 border border-stone-200 shadow-sm ${d === currentDist ? 'active bg-[#B57324] text-white border-[#B57324]' : ''}">
                        ${d === 'Tất cả' ? 'Tất cả khu vực' : d}
                    </button>
                `).join('');
            }

            // Render district dropdown
            if (districtSelect) {
                districtSelect.innerHTML = districts.map(d => `<option value="${d}">${d === 'Tất cả' ? 'Khu vực: Tất cả' : d}</option>`).join('');
                if (districts.includes(currentDist)) districtSelect.value = currentDist;
            }

            // Đồng bộ luôn cả datalist gợi ý trong modal thêm/sửa
            updateDatalists();
            updateFilterPillsUI();
            updateDistrictPillsUI();
            updateBtnToggleDrawerUI();
        }

        // Tự động cập nhật danh sách các Thể loại và Khu vực đã có sẵn để gợi ý khi nhập
        function updateDatalists() {
            const categories = [...new Set(places.map(p => p.category).filter(Boolean))];
            const districts = [...new Set(places.map(p => p.district).filter(Boolean))];

            const catListAdd = document.getElementById('existingCategories');
            const distListAdd = document.getElementById('existingDistricts');
            const catListEdit = document.getElementById('existingCategoriesEdit');
            const distListEdit = document.getElementById('existingDistrictsEdit');

            const catOptionsHTML = categories.map(c => `<option value="${c}"></option>`).join('');
            const distOptionsHTML = districts.map(d => `<option value="${d}"></option>`).join('');

            if (catListAdd) catListAdd.innerHTML = catOptionsHTML;
            if (distListAdd) distListAdd.innerHTML = distOptionsHTML;
            if (catListEdit) catListEdit.innerHTML = catOptionsHTML;
            if (distListEdit) distListEdit.innerHTML = distOptionsHTML;
        }
