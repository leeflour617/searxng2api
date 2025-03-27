// 监听fetch事件，处理所有进入的HTTP请求
addEventListener('fetch', event => {
  try {
    // 尝试处理请求并返回响应
    event.respondWith(handleRequest(event.request))
  } catch (e) {
    // 如果发生错误，返回错误信息
    event.respondWith(new Response('Error thrown ' + e.message))
  }
})

// 定义一个异步函数来处理实例请求
async function handleInstancesRequest() {
  // 使用fetch API异步获取实例数据
  const response = await fetch('https://searx.space/data/instances.json');
  // 解析响应的JSON数据
  const data = await response.json();

  // 黑名单实例列表（搜索异常的引擎）
  const BLACK_LIST = ['searx.be', 'darmarit.org'];
  // 定义必须有效的搜索引擎列表
  const REQUIRED_ENGINES = []; // ['bing', 'google', 'duckduckgo']
  // 定义允许的最大错误率（0表示不允许出错）
  const MAX_ERROR_RATE = 0;

  // 过滤出有效的实例
  const validInstances = Object.entries(data.instances)
    .filter(([url, instance]) => (
      instance.network_type === 'normal' && // 网络类型为'normal'
      instance.uptime?.uptimeDay === 100 && // 今日在线率为100%
      instance.timing?.initial?.all?.value < 1 && // 初始化耗中位数时小于 1 秒
      instance.timing?.search?.all?.median < 1 && // 搜索耗时中位数小于 1 秒
      instance.timing?.initial?.success_percentage === 100 && // 初始化成功率为100%
      instance.timing?.search?.success_percentage === 100 && // 搜索成功率为100%
      instance.timing?.search_go?.success_percentage === 100 && // Google搜索成功率为100%
      // 确保指定搜索引擎的可用性
      REQUIRED_ENGINES.every(engine => {
        const engineData = instance.engines?.[engine];
        // 情况1：引擎未启用
        if (engineData === undefined) return false;
        // 情况2：引擎已启用但未报告错误率
        if (engineData.error_rate === undefined) return true;
        // 情况3：检查错误率是否在阈值内
        return engineData.error_rate <= MAX_ERROR_RATE;
      }) &&
      // 新增黑名单检查：排除主机名在黑名单中的实例
      !BLACK_LIST.includes(new URL(url).hostname)
    ))
    .map(([url]) => url); // 从过滤结果中提取URL

  // 如果没有有效的实例，则返回null
  if (validInstances.length === 0) return null;
  // 从有效实例中随机选择一个返回
  return validInstances[Math.floor(Math.random() * validInstances.length)];
}

// 主请求处理函数
async function handleRequest(request) {
  // 解析请求的URL
  const url = new URL(request.url);
  // 获取随机的有效实例地址
  let instances = await handleInstancesRequest();
  // 没找到合适的有效实例
  if (instances === null) {
    return createUnauthorizedResponse();
  }
  // 检查最后一个字符是否为'/'并去掉
  if (instances.endsWith('/')) {
    instances = instances.slice(0, -1)
  }

  // 检查请求路径
  if (url.pathname === '/search' && url.searchParams.toString() !== '') {
    // 如果是搜索请求，调用handleSearchRequest处理
    return handleSearchRequest(request, url, instances);
  } else if (url.pathname === '/config') {
    // 如果是配置文件请求，调用handleConfigRequest处理
    return handleConfigRequest(request, url, instances);
  } else {
    // 如果不是搜索请求，返回401未授权响应
    return createUnauthorizedResponse();
  }
}

// 处理搜索请求的函数
async function handleSearchRequest(request, url, instances) {
  // 构建新的请求URL
  let newUrl = `${instances}${url.pathname}`;

  // 根据请求方法处理参数
  if (request.method === 'GET') {
    // GET请求，解析并修改查询参数中的format
    const params = new URLSearchParams(url.search);
    params.set('format', 'html'); // 强制设置format=html
    params.delete('engines'); // 删除engines
    newUrl += `?${params.toString()}`;
  } else if (request.method === 'POST') {
    // POST请求，从请求体中获取表单数据并修改format
    const formData = await request.formData();
    const params = new URLSearchParams(formData);
    params.set('format', 'html'); // 强制设置format=html
    params.delete('engines'); // 删除engines
    newUrl += `?${params.toString()}`;
  } else {
    // 如果不是GET或POST请求，返回401未授权响应
    return createUnauthorizedResponse();
  }

  // 设置Accept为'text/html'
  const headers = new Headers(request.headers);
  headers.set('Accept', 'text/html');

  // 发起请求到新的URL并返回响应
  const response = await fetch(newUrl, {
    method: request.method,
    headers: headers,
    body: request.body
  });

  try {
    // 获取HTML内容
    const htmlContent = await response.text();
    // 解析HTML转换为JSON
    const jsonData = await parseHtmlToJson(htmlContent, newUrl);
    // 将JSON对象序列化为字符串
    const jsonString = JSON.stringify(jsonData);
    // 将中文转换为Unicode编码
    const unicodeString = convertToUnicode(jsonString);
    // 返回JSON响应
    return new Response(unicodeString, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error parsing HTML:', error);
    return response;
  }
}

// 处理Config请求的函数
async function handleConfigRequest(request, url, instances) {
  // 构建新的请求URL
  let newUrl = `${instances}${url.pathname}`;
  // 发起请求到新的URL并返回响应
  const response = await fetch(newUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  return response;
}

// 创建401未授权响应的函数
function createUnauthorizedResponse() {
  const redirect = 'https://linux.do/t/topic/507581';

  // 创建响应对象，设置401状态码和重定向头
  const response = new Response('Unauthorized', {
    status: 401,
    headers: {
      'Content-Type': 'text/html',
      'Location': redirect
    }
  });

  // 设置3秒后跳转到指定URL
  response.headers.set('Refresh', `3; url=${redirect}`);

  return response;
}

// 解析HTML转换为JSON
async function parseHtmlToJson(htmlContent, newUrl) {
  // 使用简单的正则表达式提取数据，在无法使用DOM解析的环境中
  const queryMatch = htmlContent.match(/<input id="q" name="q".*?value="([^"]*?)"/i);
  const query = queryMatch ? queryMatch[1] : '';

  // 提取未响应的引擎
  const unresponsiveEngines = [];
  const engineTableRegex = /<table class="engine-stats"[^>]*>([\s\S]*?)<\/table>/i;
  const tableMatch = htmlContent.match(engineTableRegex);

  if (tableMatch) {
    const tableContent = tableMatch[1];
    const engineErrorRegex = /<td class="engine-name">\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td class="response-error">([^<]+)<\/td>/gi;

    let engineMatch;
    while ((engineMatch = engineErrorRegex.exec(tableContent)) !== null) {
      unresponsiveEngines.push([engineMatch[1].trim(), engineMatch[2].trim()]);
    }
  }

  // 提取搜索结果
  const results = [];
  const articleRegex = /<article class="result result-default category-general">([\s\S]*?)<div class="break"><\/div>\s*<\/article>/gi;

  let match;
  let position = 1;

  while ((match = articleRegex.exec(htmlContent)) !== null) {
    const articleContent = match[1];

    // 提取URL
    const urlMatch = articleContent.match(/<a href="([^"]*)" class="url_header"/i);
    const url = urlMatch ? urlMatch[1] : '';

    // 提取标题
    const titleMatch = articleContent.match(/<h3><a[^>]*>(.+?)<\/a><\/h3>/i);
    const title = titleMatch ? cleanHtmlTags(titleMatch[1]) : '';

    // 提取内容
    const contentMatch = articleContent.match(/<p class="content">\s*(.*?)\s*<\/p>/i);
    const content = contentMatch ? cleanHtmlTags(contentMatch[1]) : '';

    // 提取发布日期
    const dateMatch = articleContent.match(/<time class="published_date"\s*datetime="([^"]*)"/i);
    const publishedDate = dateMatch ? dateMatch[1] : null;

    // 提取搜索引擎
    const engineMatch = articleContent.match(/<div class="engines">\s*<span>([^<]*)<\/span>/i);
    const engine = engineMatch ? engineMatch[1].trim() : '';

    // 将搜索引擎添加到engines数组
    const engines = [];
    if (engine) {
      engines.push(engine);
    }

    // 解析URL
    const parsedUrl = parseUrl(url);

    // 创建结果对象
    const result = {
      url: url,
      title: title,
      content: content,
      publishedDate: publishedDate,
      thumbnail: null,
      engine: engine,
      template: 'default.html',
      parsed_url: parsedUrl,
      img_src: '',
      priority: '',
      engines: engines,
      positions: [position],
      score: 1 / position,
      category: 'general'
    };

    results.push(result);
    position++;
  }

  // 返回JSON对象
  return {
    proxy: newUrl, // 代理请求的实际地址
    query: query,
    number_of_results: 0,
    results: results,
    answers: [],
    corrections: [],
    infoboxes: [],
    suggestions: [],
    unresponsive_engines: unresponsiveEngines
  };
}

// 解析URL成需要的格式
function parseUrl(url) {
  if (!url) {
    return ['', '', '', '', '', ''];
  }

  const parts = ['', '', '', '', '', ''];

  // 处理协议
  if (url.startsWith('http://')) {
    parts[0] = 'http';
    url = url.substring(7);
  } else if (url.startsWith('https://')) {
    parts[0] = 'https';
    url = url.substring(8);
  }

  // 处理域名和路径
  const domainPathParts = url.split('/', 2);
  parts[1] = domainPathParts[0];

  if (domainPathParts.length > 1) {
    let path = '/' + url.substring(domainPathParts[0].length + 1);

    // 处理查询参数
    if (path.includes('?')) {
      const pathParts = path.split('?', 2);
      parts[2] = pathParts[0];
      parts[4] = pathParts[1];
    } else {
      parts[2] = path;
    }
  }

  return parts;
}

// 转换中文为Unicode字符
function convertToUnicode(str) {
  return str.replace(/[\u4e00-\u9fa5]/g, function (match) {
    return '\\u' + match.charCodeAt(0).toString(16).padStart(4, '0');
  });
}

// 清理HTML标签
function cleanHtmlTags(text) {
  return text.replace(/<[^>]+>/g, '');
}
