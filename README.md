# [searxng2api](https://github.com/Skilemon/searxng2api)

Convert the SearXNG service output from HTML to JSON for publicly available services on the internet.

把在互联网上公开的 SearXNG 服务由 HTML 输出转为 Json 输出。

## Features (特性)
- Open-source, easy to deploy, and free (开源，易于部署，且完全免费)
- Proxy SearXNG Service (代理 SearXNG 服务)
  - [x] Select highly available port from the official public instances. (从官方实例从筛选高可用性的接口)
  - [x] Proxy /config request (代理 /config 请求)
  - [x] Proxy /search request (代理 /search 请求)
  - [x] HTML to JSON (HTML 输出转为 Json 输出)

## Quickstart (快速开始)
### Prerequisite (前提条件)
- Your Cloudflare account. (你的 Cloudflare 账户)
### Setup steps (设置步骤)
1. Open your Cloudflare Workers page. (打开你的 Cloudflare Workers 页面)
2. Create a new project. (新建一个项目)
3. Copy the content of the ```index.js``` file in this project to the one you just created and save it. (将本项目中 ```index.js``` 文件的内容复制到你刚刚新建的项目里保存即可)
