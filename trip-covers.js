/**
 * Trip cover photos by type + per-user fallbacks (verified Unsplash URLs).
 */
(function () {
  const POOLS = {
    motorcycle: [
      "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=900&h=400&fit=crop&q=80"
    ],
    roadtrip: [
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900&h=400&fit=crop&q=80"
    ],
    cycling: [
      "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1511994298241-608e28f14fde?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900&h=400&fit=crop&q=80"
    ],
    hiking: [
      "https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&h=400&fit=crop&q=80"
    ],
    backpacking: [
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900&h=400&fit=crop&q=80"
    ],
    train: [
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=900&h=400&fit=crop&q=80",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&h=400&fit=crop&q=80"
    ]
  };

  const BY_TYPE = {};
  Object.keys(POOLS).forEach(type => {
    BY_TYPE[type] = POOLS[type][0];
  });

  const DEFAULT = BY_TYPE.motorcycle;

  const BROKEN_IDS = [
    "photo-1469854523086",
    "photo-1571068316344",
    "photo-1478139678776",
    "photo-1529156069898",
    "photo-1464822759023"
  ];

  const ALL_POOL_URLS = new Set(
    Object.values(POOLS).flat().map(photoId)
  );

  function photoId(url) {
    const m = String(url || "").match(/photo-\d+(?:-[a-f0-9]+)?/i);
    return m ? m[0].toLowerCase() : "";
  }

  function hashStr(s) {
    let h = 0;
    const str = String(s || "rider");
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function isUsableCover(url) {
    if (!url || typeof url !== "string") return false;
    const t = url.trim();
    if (!/^https?:\/\//i.test(t)) return false;
    return !BROKEN_IDS.some(id => t.includes(id));
  }

  /** True when URL is an auto-assigned default, not a user-picked unique photo */
  function isPooledDefault(url) {
    const id = photoId(url);
    return !id || ALL_POOL_URLS.has(id);
  }

  function coverForType(tripType) {
    return BY_TYPE[tripType] || DEFAULT;
  }

  function coverForUser(userId, tripType) {
    const pool = POOLS[tripType] || POOLS.motorcycle;
    return pool[hashStr(userId) % pool.length];
  }

  /**
   * @param {string} coverUrl - stored trip cover
   * @param {string} tripType
   * @param {string} [userId] - stable per-rider fallback
   * @param {string} [demoCover] - demo card's fixed cover (always wins)
   */
  function resolveCoverUrl(coverUrl, tripType, userId, demoCover) {
    if (demoCover && isUsableCover(demoCover)) return demoCover.trim();

    const type = tripType || "motorcycle";
    const trimmed = (coverUrl || "").trim();

    if (isUsableCover(trimmed)) {
      return trimmed;
    }

    if (userId) return coverForUser(userId, type);
    return coverForType(type);
  }

  window.RC_tripCovers = {
    POOLS,
    BY_TYPE,
    DEFAULT,
    isUsableCover,
    isPooledDefault,
    coverForType,
    coverForUser,
    resolveCoverUrl
  };
})();
