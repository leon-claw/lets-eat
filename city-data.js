(function (root) {
  const data = [
    { province: '北京市', cities: [{ name: '北京市', center: [116.4074, 39.9042] }] },
    { province: '上海市', cities: [{ name: '上海市', center: [121.4737, 31.2304] }] },
    { province: '广东省', cities: [
      { name: '广州市', center: [113.2644, 23.1291] },
      { name: '深圳市', center: [114.0579, 22.5431] },
    ] },
    { province: '浙江省', cities: [{ name: '杭州市', center: [120.1551, 30.2741] }] },
    { province: '四川省', cities: [{ name: '成都市', center: [104.0665, 30.5723] }] },
    { province: '湖北省', cities: [{ name: '武汉市', center: [114.3055, 30.5928] }] },
    { province: '江苏省', cities: [{ name: '南京市', center: [118.7969, 32.0603] }] },
    { province: '陕西省', cities: [{ name: '西安市', center: [108.9398, 34.3416] }] },
  ];

  root.LETS_EAT_CITY_DATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
}(typeof globalThis !== 'undefined' ? globalThis : this));
