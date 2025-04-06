export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};

// 定义一个异步函数来处理实例请求
async function handleInstancesRequest() {
  // 使用fetch API异步获取实例数据
  const response = await fetch('https://searx.space/data/instances.json');
  // 解析响应的JSON数据
  const data = await response.json();
  // 黑名单实例列表（搜索异常的引擎）
  const BLACK_LIST = ['searx.be', 'darmarit.org', 'search.inetol.net', 's.mble.dk'];
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
  // 返回有效实例列表
  return validInstances;
}

// 主请求处理函数
async function handleRequest(request, env) {
  // 解析请求的URL
  const url = new URL(request.url);
  // 定义实例变量
  let instances = await handleInstancesRequest();
  let instance;

  // 检查环境变量 BASE_URL
  if (typeof env.BASE_URL !== 'undefined' && env.BASE_URL) {
    instance = env.BASE_URL; // 使用用户配置的 BASE_URL
  } else {
    // 从有效实例中随机选择一个
    instance = instances[Math.floor(Math.random() * instances.length)];
    // 没找到合适的有效实例
    if (instance === null) {
      return createUnauthorizedResponse();
    }
  }

  // 检查最后一个字符是否为'/'并去掉
  if (instance.endsWith('/')) {
    instance = instance.slice(0, -1);
  }

  // 检查请求路径
  if (url.pathname === '/search' && url.searchParams.toString() !== '') {
    // 如果是搜索请求，调用handleSearchRequest处理
    return handleSearchRequest(request, url, instance, env);
  } else if (url.pathname === '/config') {
    // 如果是配置文件请求，调用handleConfigRequest处理
    return handleConfigRequest(request, url, instance);
  } else if (url.pathname === '/list') {
    // 显示可用的实例列表
    const listResult = {
      code: 200,
      data: instances
    }
    // 返回JSON响应
    return new Response(JSON.stringify(listResult), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } else {
    // 如果不是搜索请求，返回401未授权响应
    return createUnauthorizedResponse();
  }
}

// 处理搜索请求的函数
async function handleSearchRequest(request, url, instance, env) {
  // 构建新的请求URL
  let newUrl = `${instance}${url.pathname}`;

  // 根据请求方法处理参数
  if (request.method === 'GET') {
    // GET请求，解析并修改查询参数中的 format
    const params = new URLSearchParams(url.search);
    params.set('format', 'html'); // 强制设置 format=html
    // 检查环境变量 MORE_RESULT
    if (typeof env.MORE_RESULT !== 'undefined' && env.MORE_RESULT == 'enable') {
      params.delete('engines'); // 删除指定的 engines
    }
    // 当 categories 参数为空时赋予默认值
    if (params.get('categories') == null) {
      params.set('categories', 'general');
    }
    newUrl += `?${params.toString()}`;
  } else if (request.method === 'POST') {
    // POST请求，从请求体中获取表单数据并修改 format
    const formData = await request.formData();
    const params = new URLSearchParams(formData);
    params.set('format', 'html'); // 强制设置 format=html
    // 检查环境变量 MORE_RESULT
    if (typeof env.MORE_RESULT !== 'undefined' && env.MORE_RESULT == 'enable') {
      params.delete('engines'); // 删除指定的 engines
    }
    // 当 categories 参数为空时赋予默认值
    if (params.get('categories') == null) {
      params.set('categories', 'general');
    }
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
    // 返回JSON响应
    return new Response(jsonString, {
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

// 解析HTML转换为JSON，使用HTMLRewriter API
async function parseHtmlToJson(htmlContent, newUrl) {
  // 最终的解析结果
  const jsonResult = {
    proxy: newUrl,
    query: '',
    number_of_results: 0,
    results: [],
    answers: [],
    corrections: [],
    infoboxes: [],
    suggestions: [],
    unresponsive_engines: []
  };

  // 临时存储当前处理的引擎名和错误信息
  let currentEngine = null;
  let currentError = null;

  // get search value
  await new HTMLRewriter()
    .on('#q', {
      element(element) {
        // 获取元素的属性
        jsonResult.query = element.getAttribute('value');
      }
    })
    .transform(new Response(htmlContent))
    .text();

  // get error engines
  await new HTMLRewriter()
    .on('tr', {
      element(element) {
        // reset
        currentEngine = null;
        currentError = null;
      }
    })
    .on('.engine-name a', {
      text(text) {
        // 从链接文本获取引擎名称
        if (currentEngine === null) {
          currentEngine = text.text;
        }
      }
    })
    .on('.response-error', {
      text(text) {
        // 提取错误信息
        currentError = text.text;
        // 如果已有引擎名和错误信息，添加到结果数组
        if (currentEngine && currentError) {
          jsonResult.unresponsive_engines.push([currentEngine, currentError]);
        }
      }
    })
    .transform(new Response(htmlContent))
    .text();

  const params = new URLSearchParams(new URL(newUrl).search);
  const categories = params.get('categories');
  if (categories == 'general') {
    jsonResult.results = await generalParse(htmlContent);
  } else if (categories == 'images') {
    jsonResult.results = await imagesParse(htmlContent);
  } else {
    return createUnauthorizedResponse();
  }

  return jsonResult;
}

// generalParse
async function generalParse(htmlContent) {
  let result = [];
  let position = 1;
  let cuurentResult = {};
  // get search result info
  await new HTMLRewriter()
    .on('article.result', {
      element(element) {
        position++;
        cuurentResult = {
          url: '',
          title: '',
          content: '',
          publishedDate: null,
          thumbnail: null,
          engine: '',
          template: 'default.html',
          parsed_url: [],
          img_src: '',
          priority: '',
          engines: [],
          positions: [position],
          score: 1 / position,
          category: 'general'
        }
        result.push(cuurentResult);
      }
    })
    .on('article.result h3 a', {
      element(element) {
        // 获取元素的属性
        cuurentResult.url = element.getAttribute('href');
        cuurentResult.parsed_url = parseUrl(element.getAttribute('href'));
      },
      text(text) {
        // 提取标题
        cuurentResult.title += text.text;
      }
    })
    .on('article.result p.content', {
      text(text) {
        cuurentResult.content += text.text.replace('&nbsp;', '').trim();
      }
    })
    .on('article.result div.engines span', {
      text(text) {
        if (cuurentResult.engine.length == 0) {
          cuurentResult.engine += text.text;
        }
        if (text.text.length > 0) {
          cuurentResult.engines.push(text.text);
        }
      }
    })
    .on('article.result time.published_date', {
      element(element) {
        // 获取元素的属性
        cuurentResult.publishedDate = element.getAttribute('datetime');
      }
    })
    .transform(new Response(htmlContent))
    .text();

  return result;
}

// imagesParse
async function imagesParse(htmlContent) {
  let result = [];
  let position = 1;
  let cuurentResult = {};
  // get search result info
  await new HTMLRewriter()
    .on('article.result', {
      element(element) {
        position++;
        cuurentResult = {
          url: '',
          title: '',
          content: '',
          publishedDate: null,
          author: '',
          thumbnail: '',
          thumbnail_src: '',
          resolution: '',
          img_format: '',
          filesize: '',
          engine: '',
          template: 'images.html',
          parsed_url: [],
          img_src: '',
          source: '',
          priority: '',
          engines: [],
          positions: [position],
          score: 1 / position,
          category: 'images'
        }
        result.push(cuurentResult);
      }
    })
    .on('article.result div div h4', {
      text(text) {
        cuurentResult.title += text.text;
      }
    })
    .on('article.result div div p.result-url a', {
      element(element) {
        cuurentResult.url = element.getAttribute('href');
        cuurentResult.parsed_url = parseUrl(element.getAttribute('href'));
      }
    })
    .on('article.result div div p.result-content', {
      text(text) {
        cuurentResult.content += text.text.replace('&nbsp;', '').trim();
      }
    })
    .on('article.result div div p.result-engine', {
      text(text) {
        cuurentResult.engine += text.text;
      }
    })
    // image src
    .on('article.result div a.result-images-source', {
      element(element) {
        cuurentResult.img_src = element.getAttribute('href');
        cuurentResult.thumbnail_src = element.getAttribute('href');
      }
    })
    .on('article.result div div p.result-author', {
      text(text) {
        cuurentResult.author += text.text.replace('&nbsp;', '');
      }
    })
    .on('article.result div div p.result-source', {
      text(text) {
        cuurentResult.source += text.text.replace('&nbsp;', '');
      }
    })
    .on('article.result div div p.result-resolution', {
      text(text) {
        cuurentResult.resolution += text.text.replace('&nbsp;', '');
      }
    })
    .on('article.result div div p.result-img_format', {
      text(text) {
        cuurentResult.img_format += text.text;
      }
    })
    .on('article.result div div p.result-filesize', {
      text(text) {
        cuurentResult.filesize += text.text.replace('&nbsp;', '');
      }
    })
    .transform(new Response(htmlContent))
    .text();

  for (let i = 0; i < result.length; i++) {
    // resolution
    if (result[i].resolution.includes(':')) {
      result[i].resolution = result[i].resolution.split(':')[1];
    }
    // filesize
    if (result[i].filesize.includes(':')) {
      result[i].filesize = result[i].filesize.split(':')[1];
    }
    // engine
    if (result[i].engine.includes(':')) {
      result[i].engine = result[i].engine.split(':')[1];
      result[i].engines.push(result[i].engine);
    }
    // author
    if (result[i].author.includes(':')) {
      result[i].author = result[i].author.split(':')[1];
    }
    // source
    if (result[i].source.includes(':')) {
      result[i].source = result[i].source.split(':')[1];
    }
  }

  return result;
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
