// utils/sanitize.js
function capitalizeFirst(str = '') {
  const s = String(str).trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPositiveNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return isNaN(n) || n < 0 ? fallback : n;
}

function sanitizeOption(raw = {}) {
  const option = {
    imageUrl: raw.imageUrl ? String(raw.imageUrl).trim() : '',
    price: toPositiveNumber(raw.price, 0),
    label: raw.label ? capitalizeFirst(raw.label) : null,
    isHot: !!raw.isHot,
    stock: toPositiveNumber(raw.stock, 0),
    sold: toPositiveNumber(raw.sold, 0),
  };
  return option;
}

function sanitizeProductPayload(body = {}) {
  const product = {
    name: body.name ? body.name.trim() : '',
    description: body.description ? String(body.description).trim() : '',
    price: toPositiveNumber(body.price, 0),
    stock: toPositiveNumber(body.stock, 0),
    sold: toPositiveNumber(body.sold, 0),
    categories: Array.isArray(body.categories)
      ? [...new Set(body.categories.map(c => String(c).trim()).filter(Boolean))]
      : [],
    imageUrls: Array.isArray(body.imageUrls)
      ? body.imageUrls.map(u => String(u).trim()).filter(Boolean)
      : [],
    isNew: !!body.isNew,
    isHot: !!body.isHot,
    isApproved: !!body.isApproved,
    averageRating: toPositiveNumber(body.averageRating, 0),
    numReviews: toPositiveNumber(body.numReviews, 0),
    municipality: body.municipality ? String(body.municipality).trim() : '',
    option: Array.isArray(body.option)
      ? body.option.map(o => sanitizeOption(o))
      : [],
  };

  // If options exist, override aggregate stock/sold from options
  if (product.option.length > 0) {
    product.stock = product.option.reduce((sum, o) => sum + (o.stock || 0), 0);
    product.sold = product.option.reduce((sum, o) => sum + (o.sold || 0), 0);
    product.isOption = true;
  } else {
    product.isOption = false;
  }

  return product;
}

module.exports = {
  sanitizeProductPayload,
  sanitizeOption,
  capitalizeFirst,
};
