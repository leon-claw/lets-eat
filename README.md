# 附近吃什么 · 高德 Web MVP

这是一个只使用高德地图 Web JS API 的最小可行性产品，用来验证不同城市附近餐饮 POI 是否能返回：

- 省 / 市两级手动选择
- 城市中心 2 公里范围搜索
- 餐饮名称、类型、地址、距离
- 高德返回的营业时间；缺失时显示“未提供”
- 地图标记、结果列表和详情联动
- 拖动地图后手动点击“在此区域搜索”

## 本地运行

1. 复制配置文件：

   ```bash
   cp config.example.js config.js
   ```

2. 在 `config.js` 填入高德 Web 端 JS API Key；如果该 Key 要求安全密钥，也填入 `securityJsCode`。
3. 启动静态服务器：

   ```bash
   python3 -m http.server 4173
   ```

4. 打开 <http://localhost:4173>。

没有配置 Key 时页面会展示演示数据。配置 Key 后会加载高德地图，并调用 `AMap.PlaceSearch.searchNearBy` 搜索餐饮服务。

## 快速验证

建议依次测试上海市、广东省 / 广州市、四川省 / 成都市：

1. 选择省份和城市，确认地图跳转到城市中心。
2. 确认页面展示结果列表，或展示明确的高德无结果 / 错误状态。
3. 拖动地图，确认不会立刻请求；点击“在此区域搜索”后才重新查询。
4. 点击结果卡片或地图标记，确认详情包含名称、类型、地址、距离和营业时间。
5. 找到没有营业时间的 POI 时，确认页面显示“未提供”。

## 配置与安全

- `config.js` 只保存在本地，已加入 `.gitignore`，不要提交真实 Key。
- Web 端 Key 会出现在浏览器请求中，并不是服务端秘密；上线前请在高德控制台配置域名白名单、接口权限和调用额度。
- 真实数据是否包含营业时间取决于具体 POI 的高德数据覆盖情况，MVP 不会自行推断或补造。

## 核心测试

```bash
node --test test/app-core.test.js
node --check app.js
node --check app-core.js
node --check city-data.js
```
