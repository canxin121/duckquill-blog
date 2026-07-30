---
title: "中国联通短信登录"
description: "一个由 EdgeOne Pages Functions 驱动、仅在当前页面内存中保存状态的中国联通短信登录小工具。"
date: 2026-07-30
template: "unicom-login.html"
taxonomies:
  tags:
    - EdgeOne
    - China Unicom
    - 工具
extra:
  styles:
    - css/unicom-login.css
  scripts:
    - js/unicom-login.js
---

这个页面把 [china-unicom-rs](https://github.com/canxin121/china-unicom-rs) 的一次性短信登录流程放进了博客：填写手机号、完成运营商要求的安全验证、输入短信验证码，然后复制凭据包到自己的配置中。

> [!CAUTION]
> 这不是公共短信服务，只能用于自己的中国联通账号。登录结果等同于密码：不要提交到 Git，不要粘贴到聊天、Issue 或任何公开网页。

## 它如何工作

页面与同域的 `/api/unicom/*` 通信；这些接口由 EdgeOne Pages Functions 提供。函数会代表浏览器调用中国联通的官方移动端登录接口，并在需要时衔接腾讯验证码。页面和函数都不写入数据库、KV、Cookie、`localStorage` 或 `sessionStorage`。

手机号、验证码、登录上下文和最终凭据只在当前页面的内存中存在。刷新、关闭页面、离开页面或点击“清除”后，浏览器中的这些数据都会被丢弃。函数也不维护服务器端会话。

成功后会得到恰好四个字段：

```json
{
  "token_online": "…",
  "app_id": "…",
  "cookie": "ecs_token=…; ecs_acc=…",
  "captured_at": "2026-07-30T12:34:56+08:00"
}
```

将完整 JSON 复制后，可以按 [china-unicom-rs 的说明](https://github.com/canxin121/china-unicom-rs#cli)导入到自己的客户端配置中。这个页面不会替你保存、上传或自动导入凭据。

## 上线前的两项配置

### 1. 配置访问口令

在 EdgeOne Pages 项目的 **Makers / 环境变量** 中，为生产环境创建：

```text
UNICOM_LOGIN_ACCESS_KEY=使用密码管理器生成的高强度随机口令
```

不要把该值提交到仓库，也不要写进页面源码。打开本页时，站点管理员需要通过安全渠道单独提供口令；页面会在每次请求中将它发送给同源函数进行校验，但不会将其写入浏览器存储。

### 2. 配置 EdgeOne WAF 限速

函数内有一个按手机号哈希计算的短时限流，但 Edge Function 的不同实例之间不会共享这份内存，因此它不能代替边缘防护。请在 EdgeOne WAF 再建立至少两条速率限制：

1. 对 `/api/unicom/send`：每个源 IP 每分钟最多 3 次。
2. 对 `/api/unicom/*`：每个源 IP 每分钟最多 10 次。

第二条为图形验证和登录步骤留出余量；第一条专门抑制短信轰炸。若此页面只供很少的人使用，也可以在 WAF 中进一步限制可信 IP 或地区。

## 隐私与故障排查

- 腾讯验证码脚本只会在运营商明确要求安全验证时动态加载。
- 所有接口响应都带有 `Cache-Control: no-store` 和 `Referrer-Policy: no-referrer`，避免凭据进入浏览器缓存或 Referer。
- 如果页面提示“访问口令无效”，请确认 EdgeOne 生产环境变量已保存并已重新部署，再确认输入的是正确口令。
- 接口路径是相对当前域名的 `/api/unicom/*`，因此同一份博客可以在多个自定义域名上使用，无需把域名硬编码进登录工具。

运营商接口和风控策略可能随时变化。如果短信登录长期失败，请先检查 [china-unicom-rs](https://github.com/canxin121/china-unicom-rs) 是否已有对应更新。
