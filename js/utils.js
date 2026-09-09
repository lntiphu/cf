/**
 * UTILS.JS - Tiện ích tính toán, làm sạch văn bản, GPS, thời gian và ảnh
 */

// Trạng thái định vị GPS
let userLocation = null; // { lat: number, lng: number }
let isNearMeActive = false;
let isLocating = false;

        // Bảng tọa độ trung tâm dự phòng theo quận/huyện ở TP.HCM
        const DISTRICT_COORDS = {
            'Quận 1': { lat: 10.7769, lng: 106.7009 },
            'Q1': { lat: 10.7769, lng: 106.7009 },
            'Q.1': { lat: 10.7769, lng: 106.7009 },
            'Q. 1': { lat: 10.7769, lng: 106.7009 },
            '1': { lat: 10.7769, lng: 106.7009 },
            'Quận 2': { lat: 10.7872, lng: 106.7498 },
            'Q2': { lat: 10.7872, lng: 106.7498 },
            'Q.2': { lat: 10.7872, lng: 106.7498 },
            'Quận 3': { lat: 10.7844, lng: 106.6844 },
            'Q3': { lat: 10.7844, lng: 106.6844 },
            'Q.3': { lat: 10.7844, lng: 106.6844 },
            'Q. 3': { lat: 10.7844, lng: 106.6844 },
            '3': { lat: 10.7844, lng: 106.6844 },
            'Quận 4': { lat: 10.7610, lng: 106.7020 },
            'Q4': { lat: 10.7610, lng: 106.7020 },
            'Q.4': { lat: 10.7610, lng: 106.7020 },
            'Quận 5': { lat: 10.7550, lng: 106.6667 },
            'Q5': { lat: 10.7550, lng: 106.6667 },
            'Q.5': { lat: 10.7550, lng: 106.6667 },
            'Quận 6': { lat: 10.7480, lng: 106.6350 },
            'Q6': { lat: 10.7480, lng: 106.6350 },
            'Quận 7': { lat: 10.7340, lng: 106.7218 },
            'Q7': { lat: 10.7340, lng: 106.7218 },
            'Quận 8': { lat: 10.7240, lng: 106.6286 },
            'Q8': { lat: 10.7240, lng: 106.6286 },
            'Quận 9': { lat: 10.8428, lng: 106.7944 },
            'Q9': { lat: 10.8428, lng: 106.7944 },
            'Quận 10': { lat: 10.7716, lng: 106.6672 },
            'Q10': { lat: 10.7716, lng: 106.6672 },
            'Quận 11': { lat: 10.7656, lng: 106.6500 },
            'Q11': { lat: 10.7656, lng: 106.6500 },
            'Quận 12': { lat: 10.8672, lng: 106.6410 },
            'Q12': { lat: 10.8672, lng: 106.6410 },
            'Bình Thạnh': { lat: 10.8030, lng: 106.7020 },
            'Quận Bình Thạnh': { lat: 10.8030, lng: 106.7020 },
            'Phú Nhuận': { lat: 10.7992, lng: 106.6800 },
            'Quận Phú Nhuận': { lat: 10.7992, lng: 106.6800 },
            'Gò Vấp': { lat: 10.8386, lng: 106.6653 },
            'Quận Gò Vấp': { lat: 10.8386, lng: 106.6653 },
            'Tân Bình': { lat: 10.8014, lng: 106.6528 },
            'Quận Tân Bình': { lat: 10.8014, lng: 106.6528 },
            'Tân Phú': { lat: 10.7900, lng: 106.6280 },
            'Quận Tân Phú': { lat: 10.7900, lng: 106.6280 },
            'Bình Tân': { lat: 10.7650, lng: 106.6040 },
            'Quận Bình Tân': { lat: 10.7650, lng: 106.6040 },
            'Thủ Đức': { lat: 10.8494, lng: 106.7537 },
            'TP. Thủ Đức': { lat: 10.8494, lng: 106.7537 },
            'TP Thủ Đức': { lat: 10.8494, lng: 106.7537 }
        };

        // Tính khoảng cách theo công thức Haversine (km)
        function getDistanceKm(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        }

        // Lấy khoảng cách từ vị trí người dùng đến quán (km)
        function getPlaceDistance(place) {
            if (!userLocation || !place) return null;
            let lat = Number(place.lat);
            let lng = Number(place.lng);
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                const district = (place.district || '').trim();
                let fallback = DISTRICT_COORDS[district];
                if (!fallback && district) {
                    for (const key in DISTRICT_COORDS) {
                        if (district.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(district.toLowerCase())) {
                            fallback = DISTRICT_COORDS[key];
                            break;
                        }
                    }
                }
                if (fallback) {
                    lat = fallback.lat;
                    lng = fallback.lng;
                } else {
                    lat = 10.7769;
                    lng = 106.7009;
                }
            }
            return getDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
        }

        function formatDistance(distKm) {
            if (distKm == null || isNaN(distKm)) return '';
            if (distKm < 1) {
                return `Cách ${Math.round(distKm * 1000)}m`;
            }
            return `Cách ${distKm.toFixed(1)} km`;
        }

        // Bật/tắt bộ lọc Gần tôi
        function toggleNearMeFilter() {
            if (isNearMeActive) {
                isNearMeActive = false;
                updateFilterPillsUI();
                const sortSelect = document.getElementById('sortBy');
                if (sortSelect && sortSelect.value === 'distance') {
                    sortSelect.value = 'default';
                    sortBy = 'default';
                }
                currentPage = 1;
                renderPlaces();
                return;
            }

            if (isLocating) return;

            if (userLocation) {
                // Đã có vị trí trước đó, kích hoạt ngay
                isNearMeActive = true;
                const sortSelect = document.getElementById('sortBy');
                if (sortSelect) sortSelect.value = 'distance';
                sortBy = 'distance';
                updateFilterPillsUI();
                currentPage = 1;
                renderPlaces();
                return;
            }

            if (!navigator.geolocation) {
                alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
                return;
            }

            isLocating = true;
            const nearMeIcon = document.getElementById('nearMeIcon');
            const nearMeText = document.getElementById('nearMeText');
            if (nearMeIcon) nearMeIcon.className = 'fa-solid fa-spinner fa-spin text-xs text-[#B57324]';
            if (nearMeText) nearMeText.innerText = 'Đang tìm...';

            const onLocationSuccess = (pos) => {
                isLocating = false;
                userLocation = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                isNearMeActive = true;
                if (nearMeIcon) nearMeIcon.className = 'fa-solid fa-location-crosshairs text-xs text-white';
                if (nearMeText) nearMeText.innerText = 'Gần tôi';
                const sortSelect = document.getElementById('sortBy');
                if (sortSelect) sortSelect.value = 'distance';
                sortBy = 'distance';
                updateFilterPillsUI();
                currentPage = 1;
                renderPlaces();
            };

            const onLocationError = (err) => {
                // Nếu timeout với độ chính xác cao hoặc mạng yếu, tự động thử lại với GPS thường (rất quan trọng cho Laptop/PC)
                if (err && (err.code === 3 || err.code === 2)) {
                    navigator.geolocation.getCurrentPosition(
                        onLocationSuccess,
                        (fallbackErr) => {
                            isLocating = false;
                            isNearMeActive = false;
                            if (nearMeIcon) nearMeIcon.className = 'fa-solid fa-location-crosshairs text-xs text-[#B57324]';
                            if (nearMeText) nearMeText.innerText = 'Gần tôi';
                            updateFilterPillsUI();
                            let msg = 'Không thể xác định vị trí hiện tại.';
                            if (fallbackErr && fallbackErr.code === 1) {
                                msg = 'Vui lòng cho phép quyền truy cập vị trí trên trình duyệt để tìm quán gần bạn.';
                            }
                            alert(msg);
                        },
                        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
                    );
                    return;
                }

                isLocating = false;
                isNearMeActive = false;
                if (nearMeIcon) nearMeIcon.className = 'fa-solid fa-location-crosshairs text-xs text-[#B57324]';
                if (nearMeText) nearMeText.innerText = 'Gần tôi';
                updateFilterPillsUI();
                let msg = 'Không thể xác định vị trí hiện tại.';
                if (err && err.code === 1) {
                    msg = 'Vui lòng cho phép quyền truy cập vị trí trên trình duyệt để tìm quán gần bạn.';
                }
                alert(msg);
            };

            navigator.geolocation.getCurrentPosition(
                onLocationSuccess,
                onLocationError,
                { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
            );
        }

        // Quản lý vuốt chuyển trang trên di động ở khu vực giữa
        let swipeStartX = 0;
        let swipeCurrentX = 0;
        let isSwipingPage = false;

        // copy-paste hoặc dữ liệu cũ bị lỗi, đồng thời chuẩn hóa Unicode tiếng Việt.
        function sanitizeText(value) {
            return String(value ?? '')
                .normalize('NFC')
                .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
        }

        // Kiểm tra xem chuỗi có phải là chuỗi mã Base64, Data URI hoặc Token (thường do autofill Chrome điền nhầm)
        function isBase64OrToken(str) {
            if (!str || typeof str !== 'string') return false;
            const s = str.trim();
            if (s.startsWith('data:') || s.includes(';base64,')) return true;
            if (s.startsWith('eyJ') && s.includes('.')) return true; // JWT token
            // Chuỗi mã dài không dấu cách (> 30 ký tự chỉ gồm ký tự base64/hex/token)
            if (s.length >= 30 && !s.includes(' ') && /^[A-Za-z0-9+/=_-]{30,}$/.test(s)) return true;
            return false;
        }

        // Làm sạch triệt để các trường văn bản, loại bỏ hoàn toàn các chuỗi base64 hoặc metadata dính vào
        function cleanTextField(val) {
            if (val == null) return '';
            let str = String(val);
            // 1. Loại bỏ metadata EXT_META nếu còn sót lại
            str = str.replace(/\s*<!--EXT_META:.*?-->/gs, '');
            // 2. Loại bỏ chuỗi data:image/...;base64,...
            str = str.replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi, '');
            // 3. Nếu là chuỗi base64/token dài không phải link URL hợp lệ
            if (isBase64OrToken(str) && !str.startsWith('http://') && !str.startsWith('https://')) {
                return '';
            }
            return sanitizeText(str).trim();
        }

        // Chuẩn hóa riêng cho tìm kiếm: không phân biệt hoa/thường và dấu tiếng Việt.
        function normalizeSearchText(value) {
            return cleanTextField(value)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'D')
                .toLocaleLowerCase('vi-VN')
                .trim();
        }

        // Kiểm tra xem quán có đang mở cửa vào thời điểm hiện tại không (Hỗ trợ 1 hoặc nhiều khung giờ, Vd: 07:00 - 12:00, 14:00 - 22:00)
        function isOpenNow(openingHours) {
            if (!openingHours || typeof openingHours !== 'string') return null;
            const text = openingHours.toLowerCase().trim();
            if (!text) return null;
            if (text.includes('cả ngày') || text.includes('24/7') || text.includes('24h') || text.includes('24/24')) return true;

            // Bắt tất cả các cặp khoảng giờ, ví dụ: "07:00 - 12:00, 14:00 - 22:00" hoặc "07h30 - 12h & 14h - 22h"
            const regex = /(\d{1,2})[:h](\d{0,2})\s*[-–—]\s*(\d{1,2})[:h](\d{0,2})/g;
            const matches = [...text.matchAll(regex)];
            if (!matches || matches.length === 0) return null;

            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();

            for (const match of matches) {
                const startH = parseInt(match[1], 10);
                const startM = match[2] ? parseInt(match[2], 10) : 0;
                const endH = parseInt(match[3], 10);
                const endM = match[4] ? parseInt(match[4], 10) : 0;

                const startMins = startH * 60 + startM;
                let endMins = endH * 60 + endM;

                let inRange = false;
                if (endMins <= startMins) {
                    // Mở qua nửa đêm (Vd: 18:00 - 02:00)
                    inRange = (currentMins >= startMins || currentMins <= endMins);
                } else {
                    inRange = (currentMins >= startMins && currentMins <= endMins);
                }

                if (inRange) return true; // Đang trong ít nhất 1 khung giờ mở cửa
            }

            return false; // Nằm ngoài tất cả các khung giờ
        }

        // Hiển thị thông báo Toast hiện đại, tự biến mất

        function showToast(message, type = 'success') {
            let container = document.getElementById('toastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toastContainer';
                container.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm';
                document.body.appendChild(container);
            }
            const toast = document.createElement('div');
            const isSuccess = type === 'success';
            toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto border ${
                isSuccess 
                    ? 'bg-[#2D2723] text-white border-amber-900/30' 
                    : 'bg-red-700 text-white border-red-800'
            }`;
            const icon = isSuccess ? '<i class="fa-solid fa-circle-check text-emerald-400"></i>' : '<i class="fa-solid fa-circle-exclamation text-amber-300"></i>';
            toast.innerHTML = `${icon} <span>${message}</span>`;
            container.appendChild(toast);
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-4', 'opacity-0');
            });
            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3200);
        }


        // Lấy ảnh bìa đại diện cho quán (ưu tiên image -> gallery_images[0] -> image_url -> placeholder)
        function getCoverImage(place) {
            if (!place) return '';
            if (place.image && typeof place.image === 'string' && place.image.trim() && !place.image.startsWith('data:image/svg')) {
                return place.image.trim();
            }
            if (place.gallery_images) {
                try {
                    const gallery = Array.isArray(place.gallery_images) ? place.gallery_images : JSON.parse(place.gallery_images);
                    if (Array.isArray(gallery) && gallery.length > 0 && typeof gallery[0] === 'string' && gallery[0].trim() && !gallery[0].startsWith('data:image/svg')) {
                        return gallery[0].trim();
                    }
                } catch (e) {}
            }
            if (place.image_url && typeof place.image_url === 'string' && place.image_url.trim() && !place.image_url.startsWith('data:image/svg')) {
                return place.image_url.trim();
            }
            // Không có ảnh → trả về placeholder SVG trung tính
            return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23F5F0EB' width='400' height='300'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' fill='%23C4B5A5'%3E%F0%9F%93%B7%3C/text%3E%3Ctext x='50%25' y='62%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='13' fill='%23B0A090'%3ECh%C6%B0a c%C3%B3 %E1%BA%A3nh%3C/text%3E%3C/svg%3E`;
        }

         // Chỉ hiển thị giá do người dùng nhập.
         function getPlacePrice(place) {
             return place && place.price ? String(place.price).trim() : '';
        }

        // Hàm nén ảnh siêu nhẹ bằng HTML5 Canvas (chuyển sang WebP 800px, giảm 98% dung lượng để lưu trơn tru)
        function compressImage(file, maxWidth = 800, quality = 0.78) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;

                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                                resolve(dataUrl);
                            }
                        }, 'image/webp', quality);
                    };
                    img.onerror = reject;
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }


        // Lấy danh sách Vibe chính của quán (ưu tiên trường place.vibe, tự chuẩn hoá và fallback thông minh)
        function getPlaceVibes(place) {
            if (!place) return [];
            let vibes = [];
            if (Array.isArray(place.vibe)) {
                vibes = place.vibe.map(v => String(v).trim()).filter(Boolean);
            } else if (place.vibe !== undefined && place.vibe !== null) {
                const vibeStr = String(place.vibe).trim();
                if (vibeStr) {
                    vibes = vibeStr.split(',').map(v => v.trim()).filter(Boolean);
                }
            }

            if (vibes.length > 0) {
                // Viết hoa chữ cái đầu cho mỗi tag vibe
                return vibes.map(v => v.charAt(0).toUpperCase() + v.slice(1));
            }

             return [];
        }

        // Tương thích: getPlaceTags trả về đúng danh sách Vibe chính
        function getPlaceTags(place) {
            return getPlaceVibes(place);
        }



        function matchesPrice(priceStr, filterPrice) {
            if (!filterPrice) return true;
            if (!priceStr) return true;
            const nums = String(priceStr).match(/\d+/g);
            if (!nums || nums.length === 0) return true;
            const minP = parseInt(nums[0], 10);
            const maxP = nums.length > 1 ? parseInt(nums[1], 10) : minP;
            const avg = (minP + maxP) / 2;

            if (filterPrice === '< 50k') return minP < 50 || avg <= 50;
            if (filterPrice === '50–100k' || filterPrice === '50-100k') return (minP >= 35 && minP <= 100) || (avg >= 40 && avg <= 100);
            if (filterPrice === '100–150k' || filterPrice === '100-150k') return maxP >= 90 && minP <= 150;
            if (filterPrice === '> 150k') return maxP >= 120;
            return true;
        }

        function matchesAmenity(place, amenity) {
            if (!amenity) return true;
            const tags = getPlaceTags(place);
            const review = normalizeSearchText(place.review || '');
            const name = normalizeSearchText(place.name || '');
            const normAmenity = normalizeSearchText(amenity);
            if (tags.some(t => normalizeSearchText(t).includes(normAmenity))) return true;
            if (review.includes(normAmenity) || name.includes(normAmenity)) return true;
             return true;
        }

        // Lọc và sắp xếp danh sách quán

        // Ghim chuẩn 100% địa chỉ người dùng đã nhập trên Google Maps, tuyệt đối không mở nhầm sang Instagram hay link khác.
        function getPlaceMapUrl(place) {
            if (!place) return 'https://www.google.com/maps';

            let address = (place.address || '').trim();
            let district = (place.district || '').trim();

            // Lọc sạch nếu địa chỉ bị dán nhầm link Instagram hoặc link mạng xã hội ngoại lai
            if (address.includes('instagram.com') || address.includes('instagr.am') || address.startsWith('http://') || address.startsWith('https://')) {
                address = '';
            }

            const parts = [];
            if (address) parts.push(address);
            if (district && (!address || !normalizeSearchText(address).includes(normalizeSearchText(district)))) {
                parts.push(district);
            }

            const normFull = normalizeSearchText(parts.join(' '));
            if (!normFull.includes('ho chi minh') && !normFull.includes('hcm') && !normFull.includes('sai gon')) {
                parts.push('TP. Hồ Chí Minh');
            }

            let query = parts.join(', ');

            // Fallback an toàn nếu không có địa chỉ
            if (!query && place.name) {
                query = place.name.trim();
            }

            if (!query && place.lat && place.lng) {
                return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
            }

            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'TP. Hồ Chí Minh')}`;
        }


        // Trích xuất lat/lng từ link map hoặc tọa độ thủ công (Nhạy bén hơn với mọi kiểu copy-paste)
        function extractLatLng(input) {
            if (!input || input.trim() === '') return null;
            const text = input.trim();

            // 1. Dạng link Google Maps chứa @lat,lng
            const atMatch = text.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
            if (atMatch) {
                return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
            }

            // 2. Dạng link Google Maps chứa !3dlat!4dlng
            const dMatch = text.match(/!3d([-+]?\d+\.\d+)!4d([-+]?\d+\.\d+)/);
            if (dMatch) {
                return { lat: parseFloat(dMatch[1]), lng: parseFloat(dMatch[2]) };
            }

            // 3. Tìm cặp số thực (vĩ độ, kinh độ) phân tách bằng dấu phẩy ở bất kỳ đâu trong chuỗi
            const coordRegex = /([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/;
            const coordMatch = text.match(coordRegex);
            if (coordMatch) {
                return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
            }
            return null;
        }

        // 4. Phân tích trang thông tin / mạng xã hội quán (Facebook, Instagram, TikTok, Website...)
        function parsePlaceSocialLink(rawInput, placeName) {
            let input = (rawInput || '').trim();
            if (!input) {
                return {
                    title: 'TRANG THÔNG TIN',
                    displayText: '@Hiện không có',
                    url: '#',
                    iconClass: 'fa-solid fa-circle-info text-xs text-stone-400'
                };
            }

            // Kiểm tra Facebook
            if (/facebook\.com|fb\.com|fb\.watch/i.test(input)) {
                let url = input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
                let cleanText = input.replace(/^https?:\/\/(www\.)?(facebook\.com|fb\.com)\//i, '').replace(/\/$/, '');
                if (cleanText.includes('?')) cleanText = cleanText.split('?')[0];
                return {
                    title: 'TRANG FACEBOOK',
                    displayText: cleanText ? `fb.com/${cleanText}` : 'Facebook quán',
                    url: url,
                    iconClass: 'fa-brands fa-facebook text-xs text-[#1877F2]'
                };
            }

            // Kiểm tra TikTok
            if (/tiktok\.com/i.test(input)) {
                let url = input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
                let cleanText = input.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '').replace(/\/$/, '');
                if (cleanText.includes('?')) cleanText = cleanText.split('?')[0];
                return {
                    title: 'TRANG TIKTOK',
                    displayText: cleanText ? `@${cleanText}` : 'TikTok quán',
                    url: url,
                    iconClass: 'fa-brands fa-tiktok text-xs text-stone-900'
                };
            }

            // Kiểm tra Instagram
            if (/instagram\.com|instagr\.am/i.test(input) || input.startsWith('@')) {
                const handle = input.replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\//i, '').replace(/\/$/, '');
                return {
                    title: 'TRANG INSTAGRAM',
                    displayText: handle ? `@${handle}` : input,
                    url: `https://www.instagram.com/${handle}/`,
                    iconClass: 'fa-brands fa-instagram text-xs text-[#E4405F]'
                };
            }

            // Kiểm tra Website hoặc URL bất kỳ (có http/https hoặc domain phổ biến)
            if (input.startsWith('http://') || input.startsWith('https://') || /\.(vn|com|net|org|co|info|me|cafe|food|io)/i.test(input)) {
                let url = input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
                let cleanText = input.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
                if (cleanText.length > 30) {
                    cleanText = cleanText.slice(0, 27) + '...';
                }
                return {
                    title: 'TRANG THÔNG TIN',
                    displayText: cleanText,
                    url: url,
                    iconClass: 'fa-solid fa-globe text-xs text-[#B57324]'
                };
            }

            // Mặc định: Coi như tên tài khoản mạng xã hội / Instagram
            const cleanHandle = input.replace(/^@/, '');
            return {
                title: 'TRANG THÔNG TIN',
                displayText: `@${cleanHandle}`,
                url: `https://www.instagram.com/${cleanHandle}/`,
                iconClass: 'fa-brands fa-instagram text-xs text-[#E4405F]'
            };
        }


