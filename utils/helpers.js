const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const generateCacheKey = (prefix, ...params) => {
  return `${prefix}:${params.join(":")}`;
};

const isValidCoordinate = (lat, lng) => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const prioritizeAlert = (content) => {
  const urgentKeywords = [
    "sos",
    "urgent",
    "emergency",
    "help",
    "trapped",
    "critical",
  ];
  const highKeywords = ["need", "require", "assistance", "rescue"];

  const lowerContent = content.toLowerCase();

  if (urgentKeywords.some((keyword) => lowerContent.includes(keyword))) {
    return "urgent";
  }
  if (highKeywords.some((keyword) => lowerContent.includes(keyword))) {
    return "high";
  }
  return "medium";
};

module.exports = {
  calculateDistance,
  generateCacheKey,
  isValidCoordinate,
  prioritizeAlert,
};
