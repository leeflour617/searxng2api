# [searxng2api](https://github.com/Skilemon/searxng2api)
Convert the SearXNG service output from HTML to JSON for publicly available services on the internet.

把在互联网上公开的 SearXNG 服务由 HTML 输出转为 Json 输出。

## Features (特性)
- Open-source, easy to deploy, and free. (开源，易于部署，且完全免费)
- Proxy SearXNG Service. (代理 SearXNG 服务)
  - [x] Select highly available port from the official public instances. (从官方实例从筛选高可用性的接口)
  - [x] Proxy /config request. (代理 /config 请求)
  - [x] Proxy /search request. (代理 /search 请求)
  - [x] HTML to JSON. (HTML 输出转为 Json 输出)

<!-- ## Plan (开发计划) -->
<!-- - [ ]  -->

## Updates (更新记录)
### 2025-04-04
1. By ```BASE_URL``` variables to proxy the specified SearXNG service. (通过 ```BASE_URL``` 变量来代理指定的 SearXNG 服务)
2. Obtain the list of available instances through the ```/list``` request. (通过 ```/list``` 请求获取可用的实例列表)
### 2025-03-27
1. Add blacklist list, exclude abnormal instance addresses. (新增黑名单列表，排除异常实例地址)
2. Optimize the logic for judging service availability. (优化服务可用性的判断逻辑)
### 2025-03-24
1. Changes adapted for Cherry Studio v1.1.10. (适配 Cherry Studio v1.1.10 的更改)
### 2025-03-23
1. Re-evaluate the availability of SearXNG service from multiple aspects. (从多个方面重新判断 SearXNG 服务的可用性)
### 2025-03-22
1. First release. (第一版)

## Quickstart (快速开始)
### Use (直接使用)
Enter the following address into Cherry Studio or other applications. (把以下地址填入 Cherry Studio 或其它应用中)
- [https://searxng2api.svia.workers.dev](https://searxng2api.svia.workers.dev)
### Deployment (自行部署)
1. A Cloudflare account. (一个 Cloudflare 账户)
2. Open your Cloudflare Workers page. (打开你的 Cloudflare Workers 页面)
3. Create a new project. (新建一个项目)
4. Copy the content of the ```worker.js``` file in this project to the one you just created and save it. (将本项目中 ```worker.js``` 文件的内容复制到你刚刚新建的项目里保存即可)
