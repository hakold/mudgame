// 天气与时间系统服务
const weatherConfig = require('../../../config/json/weatherConfig.json');

class WeatherTimeService {
  constructor() {
    this.config = weatherConfig;
    this.currentWeather = new Map(); // roomId -> weather
    this.speedMultiplier = this.config.timeCycle.speedMultiplier || 6;
    this.gameEpoch = Date.now();
  }

  // 获取当前游戏时间
  getGameTime() {
    const realElapsed = Date.now() - this.gameEpoch;
    const gameElapsed = realElapsed * this.speedMultiplier;
    // 游戏世界以 epoch=0 开始，每天86400秒
    const gameSeconds = Math.floor(gameElapsed / 1000) % 86400;
    return {
      hours: Math.floor(gameSeconds / 3600),
      minutes: Math.floor((gameSeconds % 3600) / 60),
      day: Math.floor(gameElapsed / 1000 / 86400),
      totalGameSeconds: Math.floor(gameElapsed / 1000)
    };
  }

  // 获取当前时间段
  getCurrentPeriod() {
    const time = this.getGameTime();
    const period = this.config.timeCycle.periods.find(p => p.hours.includes(time.hours));
    return period || this.config.timeCycle.periods[0];
  }

  // 获取房间天气
  getRoomWeather(roomId) {
    // 确定区域
    const region = this.getRegionFromRoom(roomId);
    const regionConfig = this.config.regionWeather[region] || this.config.regionWeather.village;
    
    // 如果已有缓存且未过期
    const cached = this.currentWeather.get(roomId);
    if (cached && Date.now() - cached.updatedAt < 300000) { // 5分钟缓存
      return cached.weather;
    }

    // 随机生成天气
    const weather = this.generateWeather(regionConfig);
    this.currentWeather.set(roomId, { weather, updatedAt: Date.now() });
    return weather;
  }

  // 生成天气
  generateWeather(regionConfig) {
    const types = this.config.weatherTypes;
    const totalWeight = types.reduce((sum, t) => sum + (t.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const type of types) {
      random -= (type.weight || 1);
      if (random <= 0) {
        return type;
      }
    }
    
    return types[0]; // 默认晴朗
  }

  // 从房间ID推断区域
  getRegionFromRoom(roomId) {
    if (roomId.startsWith('snow_')) return 'snow';
    if (roomId.startsWith('desert_')) return 'desert';
    if (roomId.startsWith('mountain_') || roomId.startsWith('wudang_') || roomId.startsWith('shaolin_')) return 'mountain';
    if (roomId.startsWith('forest_') || roomId.startsWith('emei_')) return 'forest';
    if (roomId.startsWith('city_')) return 'city';
    return 'village';
  }

  // 获取时间段效果
  getPeriodEffects() {
    const period = this.getCurrentPeriod();
    return period.effects || {};
  }

  // 获取天气效果
  getWeatherEffects(roomId) {
    const weather = this.getRoomWeather(roomId);
    return weather.effects || {};
  }

  // 格式化时间显示
  formatGameTime() {
    const time = this.getGameTime();
    const period = this.getCurrentPeriod();
    return {
      timeStr: `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`,
      periodName: period.name,
      periodDesc: period.description,
      effects: period.effects
    };
  }

  // 清理过期天气缓存
  cleanup() {
    const now = Date.now();
    for (const [roomId, data] of this.currentWeather) {
      if (now - data.updatedAt > 600000) { // 10分钟过期
        this.currentWeather.delete(roomId);
      }
    }
  }
}

module.exports = new WeatherTimeService();