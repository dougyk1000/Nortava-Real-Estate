import { escapeHtml } from '../utils/sanitize.js';
import {
  getProvinces,
  getCitiesByProvince,
  getZonesByCity,
  formatLocationLabel,
  parseLocationString
} from './zimbabweLocations.js';

export function initListingLocationPicker({
  provinceEl,
  cityEl,
  areaEl,
  detailEl,
  previewEl,
  defaultProvince = 'Mashonaland West',
  defaultCity = 'Norton'
}) {
  if (!provinceEl || !cityEl || !areaEl) {
    return {
      getLocationString: () => '',
      setLocationFromString: () => {}
    };
  }

  function renderProvinces(selected = '') {
    const provinces = getProvinces();
    provinceEl.innerHTML = '<option value="">Select Province</option>' +
      provinces.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    if (selected && provinces.includes(selected)) {
      provinceEl.value = selected;
    }
  }

  function renderCities(province, selectedCity = '') {
    const cities = province ? getCitiesByProvince(province) : [];
    cityEl.innerHTML = '<option value="">Select City / Town / District</option>' +
      cities.map(c => `<option value="${escapeHtml(c.city)}">${escapeHtml(c.city)}</option>`).join('');
    cityEl.disabled = !province;
    if (selectedCity && cities.some(c => c.city === selectedCity)) {
      cityEl.value = selectedCity;
    }
  }

  function renderAreas(city, province, selectedArea = '') {
    const zones = city ? getZonesByCity(city, province) : [];
    areaEl.innerHTML = '<option value="">Select Suburb / Area</option>' +
      zones.map(z => `
        <optgroup label="${escapeHtml(z.zone)}">
          ${z.areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
        </optgroup>
      `).join('') +
      (city ? '<option value="__other__">Other / Custom Area (type below)</option>' : '');

    areaEl.disabled = !city;
    if (selectedArea) {
      const exists = Array.from(areaEl.options).some(o => o.value === selectedArea);
      areaEl.value = exists ? selectedArea : '__other__';
    }
  }

  function updatePreview() {
    if (!previewEl) return;
    const formatted = getLocationString();
    previewEl.textContent = formatted || 'Select Province, City/Town, and Suburb above';
  }

  function getLocationString() {
    const province = provinceEl.value || '';
    const city = cityEl.value || '';
    const area = areaEl.value === '__other__' ? '' : (areaEl.value || '');
    const customDetail = detailEl?.value?.trim() || '';

    return formatLocationLabel({
      customDetail,
      area,
      city,
      province
    });
  }

  function setLocationFromString(locationStr = '') {
    const parsed = parseLocationString(locationStr);
    const prov = parsed.province || defaultProvince;
    renderProvinces(prov);
    const city = parsed.city || (prov === defaultProvince ? defaultCity : '');
    renderCities(prov, city);
    renderAreas(city, prov, parsed.area || '');

    if (detailEl) {
      if (!parsed.area && parsed.raw && !parsed.city) {
        detailEl.value = parsed.raw;
        if (city) areaEl.value = '__other__';
      } else {
        detailEl.value = '';
      }
    }
    updatePreview();
  }

  provinceEl.addEventListener('change', () => {
    renderCities(provinceEl.value, '');
    renderAreas('', '', '');
    updatePreview();
  });

  cityEl.addEventListener('change', () => {
    renderAreas(cityEl.value, provinceEl.value, '');
    updatePreview();
  });

  areaEl.addEventListener('change', () => {
    if (detailEl) {
      detailEl.placeholder = areaEl.value === '__other__'
        ? 'Enter suburb / village / growth point name'
        : 'Optional street, phase, or stand (e.g., Phase 2)';
    }
    updatePreview();
  });

  detailEl?.addEventListener('input', updatePreview);

  renderProvinces(defaultProvince);
  renderCities(defaultProvince, defaultCity);
  renderAreas(defaultCity, defaultProvince, '');
  updatePreview();

  return {
    getLocationString,
    setLocationFromString
  };
}
