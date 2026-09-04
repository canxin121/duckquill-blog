+++
authors = ["canxin"]
title = "Mihomo DNS 泄露修复：从系统 DNS、TUN 劫持到 split-DNS 的完整闭环"
description = "一套完整的 Mihomo DNS 防泄露方案：接管系统 DNS、同时劫持 UDP/TCP 53、使用加密上游、实施 split-DNS，并处理 DoT、IPv6 与 DNS 泄露检测站点。"
date = 2026-09-04
updated = 2026-09-04
slug = "fix-dns-leaks"
[taxonomies]
tags = ["Mihomo", "DNS", "DNS 泄露", "代理", "macOS", "Android", "网络"]
[extra]
toc = true
toc_inline = true
+++

## 先检测：确认当前是否存在 DNS 泄露

在修改配置之前，应先确认当前网络是否确实存在 DNS 泄露。最直接的方法是使用在线检测服务。启用代理后，可依次打开以下页面：

- [BrowserLeaks DNS Leak Test](https://browserleaks.com/dns)
- [DNSLeakTest](https://www.dnsleaktest.com/)
- [IPLeak](https://ipleak.net/)
- [Whoer DNS Leak Test](https://whoer.net/dns-leak-test)
- [DNSCheck.tools](https://dnscheck.tools/)

建议至少使用其中两个服务交叉验证。`DNSLeakTest` 可进一步运行 **Extended Test**，以增加测试查询数量。

判断结果时，不应只关注页面是否显示 “Protected” 或 “No leak”，而应查看实际出现的 DNS resolver、运营商和地理位置。若代理已经启用，但结果仍出现本地宽带运营商、公司或学校 DNS、家庭路由器对应的上游解析服务，通常说明 DNS 查询仍存在未被代理链路接管的路径。

相反，若结果稳定显示为预期的公共递归 DNS 或代理出口侧解析器，例如 Cloudflare、Google，且不再出现本地 ISP 的 resolver，则说明 DNS 泄露风险已显著降低。需要注意，在线测试只能观察最终参与递归解析的服务器，不能完整证明本机所有 DNS 流量都严格经过预期路径；因此在出现异常结果时，仍应结合后文的系统 DNS、TUN 与抓包检查进行定位。

启用代理后，公网 IP 已经变化，并不意味着 DNS 查询也已经进入代理链路。常见情况是 HTTPS 流量由 Mihomo 转发，但系统仍将 DNS 请求发送给路由器、运营商或局域网 DNS；也可能只有 UDP 53 被接管，而 TCP 53、IPv6 或 Android Private DNS 使用的 853/DoT 仍经由未受控路径直接出站。

本文采用的处理方式不是单独替换 `nameserver`，而是将 DNS 视为一条完整的解析与出站链路：

```text
应用
  ↓
系统 DNS → 127.0.0.1:53 / Android DNS 重定向
  ↓
Mihomo DNS
  ├─ 国内 / 私有域名 → 国内 DoH → DIRECT
  └─ 国外 / 未知域名 → Cloudflare / Google DoH → 🔒 DNS代理
                                  ↓
                              非大陆代理节点
```

同时，TUN 继续接管应用直接发出的 UDP/TCP 53，规则层再对 DoH 域名与 853/DoT 提供额外约束，从而统一处理系统 DNS、应用自带 DNS、IPv4/IPv6 以及普通 DNS/DoT。

## DNS 泄露通常发生在哪里

首先需要区分几个容易被混淆的环节。

### 代理接管网页，不等于接管系统 DNS

浏览器访问 `example.com` 时，系统通常要先知道它对应哪个 IP。这个查询完全可能先发给路由器，再由路由器转发给运营商 DNS；等 IP 拿回来以后，真正的 HTTPS 连接才进入代理。

因此，仅确认网页流量已经经过代理并不足以证明 DNS 已被接管；DNS 查询本身也必须具有明确且受控的入口。

### 只劫持 UDP 53 也不够

传统 DNS 最常见的是 UDP 53，但协议本身也会使用 TCP 53。只写：

```yaml
dns-hijack:
  - any:53
```

并不能完整覆盖普通 DNS。

更完整的配置应同时包含：

```yaml
dns-hijack:
  - any:53
  - tcp://any:53
```

这样可使 TUN 同时接管 UDP 与 TCP 53。

### IPv6 是另一条可能被忽略的出口

如果系统具备 IPv6，而配置仅处理 IPv4，则 DNS 查询或后续连接仍可能通过 IPv6 直接出站。因此，顶层、TUN 与 DNS 三个层面应保持一致的 IPv6 配置：

```yaml
ipv6: true

tun:
  inet6-address:
    - fdfe:dcba:9876::1/126

dns:
  ipv6: true
  fake-ip-range6: fdfe:dcba:9876::1/64
```

这并不要求每台设备都具有公网 IPv6，而是避免在代理内部主动丢弃 IPv6 路径，造成 IPv4 与 IPv6 行为不一致。

## 第一层：先让系统 DNS 真正交给 Mihomo

这是防泄露链路中最关键的前置条件之一。

在 macOS 和普通 Linux 的 TUN 场景中，可以让 Mihomo DNS 直接监听回环地址的标准 DNS 端口：

```yaml
dns:
  enable: true
  listen: 127.0.0.1:53
```

随后，还需要将操作系统侧的 DNS 明确指向 `127.0.0.1`。

### macOS

首先确认实际网络服务名称：

```bash
networksetup -listallnetworkservices
```

如果当前使用的是 `Wi-Fi`：

```bash
sudo networksetup -setdnsservers Wi-Fi 127.0.0.1
```

查看结果：

```bash
networksetup -getdnsservers Wi-Fi
scutil --dns
```

停止使用 Mihomo 后，可恢复自动 DNS：

```bash
sudo networksetup -setdnsservers Wi-Fi Empty
```

此处不能仅依赖 TUN 的 `dns-hijack`。如果 macOS 仍将系统 DNS 指向局域网路由器，查询仍可能沿物理接口直接发送到局域网地址，尤其是在配置为了保留局域网访问而排除私有网段的情况下。

### Linux

Linux 的原则相同：系统 resolver 最终应指向 `127.0.0.1`。具体配置方式取决于 NetworkManager、systemd-resolved、netplan 或 `/etc/resolv.conf` 等实际使用的解析管理组件。

可通过以下命令检查：

```bash
cat /etc/resolv.conf
resolvectl status
```

公网服务器还需要特别注意云厂商自动下发的私网 DNS。即使 Mihomo TUN 工作正常，只要系统查询仍指向 VPC 内部 DNS，且相应私网地址位于 TUN 排除范围内，查询就可能在进入 Mihomo 之前直接完成。

## 第二层：TUN 同时接管 UDP/TCP 53

系统 DNS 指向 Mihomo 后，还需要处理应用绕过系统 resolver、直接向外部发送 53 端口查询的情况。

通用 TUN profile 可保留以下配置：

```yaml
tun:
  enable: true
  stack: mixed
  dns-hijack:
    - any:53
    - tcp://any:53
  auto-route: true
  auto-redirect: true
  auto-detect-interface: true
  strict-route: true
```

其中三个关键点是：

- `dns-hijack` 同时覆盖 UDP/TCP 53；
- `auto-route` 让 TUN 自动建立需要的路由接管；
- `strict-route` 应保持启用，避免原本应进入 TUN 的流量重新落回系统默认路由。

如果使用配置生成器，建议将 `enable`、`auto-route` 与 `strict-route` 设为强制校验项；这些关键选项一旦被关闭，DNS 防泄露能力通常也会随之下降。

## 第三层：所有常规上游 DNS 都使用加密协议

完成查询入口接管后，下一步是定义 Mihomo 使用的上游解析器。

常规上游解析可统一使用 HTTPS DoH，避免继续使用明文 UDP DNS。

精简结构如下：

```yaml
dns:
  enable: true
  listen: 127.0.0.1:53
  ipv6: true
  cache-algorithm: arc
  prefer-h3: false
  enhanced-mode: fake-ip
  respect-rules: true

  fake-ip-range: 198.18.0.1/16
  fake-ip-range6: fdfe:dcba:9876::1/64
  fake-ip-filter-mode: blacklist
  fake-ip-filter:
    - +.lan
    - +.local

  default-nameserver:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT

  nameserver:
    - https://cloudflare-dns.com/dns-query#🔒 DNS代理
    - https://dns.google/dns-query#🔒 DNS代理

  proxy-server-nameserver:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT
```

### `default-nameserver` 为什么使用 IP 地址形式的 DoH

如果默认上游写成：

```yaml
https://dns.example.com/dns-query
```

Mihomo 首先需要获得 `dns.example.com` 的 IP，因此会产生“连接 DNS 服务之前仍需完成一次 DNS 解析”的 bootstrap 问题。

因此，这里使用 IP literal 形式的 DoH 地址，并明确指定 `#DIRECT`。这是一条有意保留的控制面直连路径：它负责 DNS bootstrap 和代理节点域名解析，而不承担普通网页域名的默认解析。

### `proxy-server-nameserver` 单独存在的原因

代理节点本身也可能以域名作为服务器地址。如果解析该节点域名必须先经过该节点，就会形成循环依赖。

因此，代理节点域名应使用独立的 `proxy-server-nameserver`，并通过能够直接建立连接的 IP 型加密 DoH 完成解析。

## 第四层：使用 split-DNS 区分国内与国外解析

如果所有域名都交由国外 DNS 解析，国内 CDN、运营商线路以及部分服务的调度质量可能下降；如果所有域名都交由国内 DNS 解析，则国外域名的查询仍会暴露给国内解析链路。

因此可以采用以下 split-DNS 策略：

- `geosite:private` 和 `geosite:cn` 明确走国内 DoH + `DIRECT`；
- 其他域名默认走 Cloudflare / Google DoH + `🔒 DNS代理`。

```yaml
nameserver-policy:
  geosite:private:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT

  geosite:cn:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT
```

关键并不在于固定使用某一家国内 DNS，而在于使 **DNS 解析策略与后续流量的地域策略保持一致**。

国内域名可以获得更符合大陆网络环境的解析结果；国外与未知域名则不会因为默认 DNS 仍为本地 resolver 而进入本地解析链路。

## 为什么不使用 `direct-nameserver`

部分 Mihomo 配置会额外设置 `direct-nameserver`，使最终选择 `DIRECT` 的连接重新使用另一套 DNS。

在上述 split-DNS 方案中，这可能引入第二次解析。

例如，某个域名先按照 `nameserver-policy` 使用国外 DoH，随后流量规则判断该连接应选择 `DIRECT`；如果此时再次触发 `direct-nameserver`，该域名可能被交给国内 DNS 重新解析。这样，域名应由哪一套 DNS 处理就不再完全由 split-DNS 决定，而会被最终出站策略再次覆盖。

因此，配置中可以明确要求：

```text
direct-nameserver 必须不存在
```

国内或私有域名是否使用国内 DNS，应仅由 `nameserver-policy` 明确决定。

## 第五层：确保 `🔒 DNS代理` 不可到达 DIRECT

国外 DoH 写了：

```yaml
https://cloudflare-dns.com/dns-query#🔒 DNS代理
```

仅有这一写法并不能保证安全，仍需检查 `🔒 DNS代理` 策略组最终能够选择或间接到达哪些出口。

该策略组应满足以下约束：

- 可以选择国外节点；
- 可以选择港澳台节点；
- 不包含大陆节点；
- 不能直接或间接到达 `DIRECT`；
- 不能到达 `REJECT`。

示意：

```yaml
proxy-groups:
  - name: 🔒 DNS代理
    type: select
    proxies:
      - ⚡ 国外自动
      - ⚖️ 国外均衡
      - ⚡ 港澳台自动
      - ⚖️ 港澳台均衡
      # 可继续列出其他非大陆节点
```

如果 `DIRECT` 被加入 DNS 策略组，国外 DoH 就可能直接从本地网络出站；如果该策略组能够通过其他嵌套策略间接到达 `DIRECT`，同样会产生这一问题。

因此，如果使用配置生成器，更稳妥的做法是执行策略“可达性检查”，而不是仅检查当前列表中是否直接出现 `DIRECT`。

## 第六层：泄露检测网站必须在 DNS 和流量两边都强制走国外

这一问题容易导致测试结果出现误判。

某些 geosite 数据可能将检测站点或其相关域名归入不符合预期的类别。当 DNS leak test 页面本身或其生成的探测域名被国内规则接管时，测试结果可能表现得与真实 DNS 泄露相似。

因此，可将常用检测站点置于 `nameserver-policy` 的前部，强制使用国外 DoH：

```yaml
nameserver-policy:
  +.browserleaks.com:
    - https://cloudflare-dns.com/dns-query#🔒 DNS代理
    - https://dns.google/dns-query#🔒 DNS代理

  +.dnsleaktest.com:
    - https://cloudflare-dns.com/dns-query#🔒 DNS代理
    - https://dns.google/dns-query#🔒 DNS代理

  +.ipleak.net:
    - https://cloudflare-dns.com/dns-query#🔒 DNS代理
    - https://dns.google/dns-query#🔒 DNS代理

  +.whoer.net:
    - https://cloudflare-dns.com/dns-query#🔒 DNS代理
    - https://dns.google/dns-query#🔒 DNS代理

  +.dnscheck.tools:
    - https://cloudflare-dns.com/dns-query#🔒 DNS代理
    - https://dns.google/dns-query#🔒 DNS代理

  geosite:private:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT

  geosite:cn:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT
```

流量规则同样应将这些站点置于较高优先级：

```yaml
rules:
  - DOMAIN-SUFFIX,browserleaks.com,✈️ 国外
  - DOMAIN-SUFFIX,dnsleaktest.com,✈️ 国外
  - DOMAIN-SUFFIX,ipleak.net,✈️ 国外
  - DOMAIN-SUFFIX,whoer.net,✈️ 国外
  - DOMAIN-SUFFIX,dnscheck.tools,✈️ 国外
```

这样可以确保测试站点的 **DNS 查询** 与 **实际连接** 使用同一类国外出口，并避免被后续大型规则集覆盖。

## 第七层：为 DoH 域名和 853/DoT 增加规则兜底

国外 DoH 本身属于 HTTPS 流量，因此还应将 DoH 服务域名显式送入 DNS 代理组：

```yaml
rules:
  - DOMAIN-SUFFIX,cloudflare-dns.com,🔒 DNS代理
  - DOMAIN-SUFFIX,dns.google,🔒 DNS代理
  - DST-PORT,853,🔒 DNS代理
```

前两条用于保证 Cloudflare / Google DoH 建连时仍通过 DNS 专用代理出口。

`DST-PORT,853` 用于为 DoT 提供兜底。它不能将任意 DoT 自动转换为 Mihomo 内置 DNS 查询，但可以避免 853 流量直接落入本地默认路由。

需要注意：**这一规则不能替代系统层 DNS 接管。** 特别是在 Android 上，Private DNS 可能使用 853；更稳妥的做法仍然是关闭 Private DNS，使普通系统 DNS 进入 Mihomo 管理的 53 端口链路。

## Android + Box for Magisk 需要采用独立接法

Box for Magisk 的 TPROXY 模式与普通 Mihomo TUN 使用不同的网络接管模型，因此不能直接复用前述 TUN 配置。

BFM profile 可以采用以下结构：

```yaml
tproxy-port: 9898

tun:
  enable: false

dns:
  enable: true
  listen: :1053
  ipv6: true
  enhanced-mode: fake-ip
```

随后由 Box for Magisk 创建 IPv4/IPv6 的 iptables/ip6tables、fwmark、策略路由与 DNS 重定向，将 Android 与热点客户端的 UDP/TCP 53 转发至 Mihomo `1053`。

此处需要区分以下职责：

1. BFM TPROXY 模式下，不应再启用 Mihomo TUN 的 `auto-route` / `auto-redirect` 参与同一批透明代理流量的接管；
2. `tproxy-port: 9898` 是透明代理监听，`dns.listen: :1053` 是 DNS 服务，两者不是同一个端口；
3. Android 的“私人 DNS / Private DNS”建议关闭；
4. 启用 IPv6 时，应确认 BFM 的 IPv6 TPROXY 规则确实创建成功，而不能只依赖 YAML 中的 `ipv6: true`。

`853 → 🔒 DNS代理` 在 Android 上仅作为泄露兜底，不能替代对 Private DNS 的完整处理。

## fake-ip 的常见误区

本文采用：

```yaml
enhanced-mode: fake-ip
fake-ip-range: 198.18.0.1/16
fake-ip-range6: fdfe:dcba:9876::1/64
fake-ip-filter-mode: blacklist
```

仅对确实需要真实 IP 的少量域名设置例外：

```yaml
fake-ip-filter:
  - +.lan
  - +.local
```

不建议为了扩大兼容性直接使用：

```yaml
fake-ip-filter:
  - '*'
```

这实际上等同于让所有域名绕过 fake-ip。依赖域名映射与嗅探的透明代理行为会因此退化，也更难保证 DNS 解析策略与连接策略保持一致。

## 精简配置模板

综合以上关键点，一个适用于普通 macOS / Linux TUN 场景的配置骨架如下：

```yaml
mode: rule
ipv6: true

external-controller: 127.0.0.1:9090

tun:
  enable: true
  stack: mixed
  dns-hijack:
    - any:53
    - tcp://any:53
  auto-route: true
  auto-redirect: true
  auto-detect-interface: true
  strict-route: true
  inet6-address:
    - fdfe:dcba:9876::1/126

dns:
  enable: true
  listen: 127.0.0.1:53
  ipv6: true
  cache-algorithm: arc
  prefer-h3: false
  enhanced-mode: fake-ip
  respect-rules: true
  fake-ip-range: 198.18.0.1/16
  fake-ip-range6: fdfe:dcba:9876::1/64
  fake-ip-filter-mode: blacklist
  fake-ip-filter:
    - +.lan
    - +.local

  default-nameserver:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT

  nameserver:
    - https://cloudflare-dns.com/dns-query#🔒 DNS代理
    - https://dns.google/dns-query#🔒 DNS代理

  proxy-server-nameserver:
    - https://223.5.5.5/dns-query#DIRECT
    - https://1.12.12.12/dns-query#DIRECT

  nameserver-policy:
    +.browserleaks.com:
      - https://cloudflare-dns.com/dns-query#🔒 DNS代理
      - https://dns.google/dns-query#🔒 DNS代理
    +.dnsleaktest.com:
      - https://cloudflare-dns.com/dns-query#🔒 DNS代理
      - https://dns.google/dns-query#🔒 DNS代理
    +.ipleak.net:
      - https://cloudflare-dns.com/dns-query#🔒 DNS代理
      - https://dns.google/dns-query#🔒 DNS代理
    +.whoer.net:
      - https://cloudflare-dns.com/dns-query#🔒 DNS代理
      - https://dns.google/dns-query#🔒 DNS代理
    +.dnscheck.tools:
      - https://cloudflare-dns.com/dns-query#🔒 DNS代理
      - https://dns.google/dns-query#🔒 DNS代理
    geosite:private:
      - https://223.5.5.5/dns-query#DIRECT
      - https://1.12.12.12/dns-query#DIRECT
    geosite:cn:
      - https://223.5.5.5/dns-query#DIRECT
      - https://1.12.12.12/dns-query#DIRECT

proxy-groups:
  - name: 🔒 DNS代理
    type: select
    proxies:
      - ⚡ 国外自动
      - ⚖️ 国外均衡
      # 在此列出非大陆代理入口，不应加入 DIRECT / REJECT

rules:
  - DOMAIN-SUFFIX,browserleaks.com,✈️ 国外
  - DOMAIN-SUFFIX,dnsleaktest.com,✈️ 国外
  - DOMAIN-SUFFIX,ipleak.net,✈️ 国外
  - DOMAIN-SUFFIX,whoer.net,✈️ 国外
  - DOMAIN-SUFFIX,dnscheck.tools,✈️ 国外
  - DOMAIN-SUFFIX,cloudflare-dns.com,🔒 DNS代理
  - DOMAIN-SUFFIX,dns.google,🔒 DNS代理
  - DST-PORT,853,🔒 DNS代理
  # 此后继续接入完整规则集
```

这并不是一份可以直接运行的完整配置：`⚡ 国外自动`、`⚖️ 国外均衡`、`✈️ 国外` 等策略组需要在实际配置中定义。重点在于各 DNS 组件之间形成一致、可验证的解析与出站关系。

## 在线测试异常后的进一步验证

如果在线测试仍显示本地 ISP、公司或学校 DNS，或出现其他异常 resolver，可继续从监听状态、系统 resolver 与物理网卡流量三个层面定位。

### 1. 确认 Mihomo 正在本机监听 53

macOS / Linux 可使用：

```bash
sudo lsof -nP -iTCP:53 -iUDP:53
```

普通 TUN profile 应能够看到 Mihomo 对 `127.0.0.1:53` 的监听。

### 2. 确认系统 DNS 是 127.0.0.1

macOS：

```bash
scutil --dns
networksetup -getdnsservers Wi-Fi
```

Linux：

```bash
cat /etc/resolv.conf
resolvectl status
```

如果此处仍然出现路由器地址，例如 `192.168.1.1`，应优先修正系统 DNS，而不是仅调整 Mihomo 的 `nameserver`。

### 3. 直接向 Mihomo 发起查询

```bash
dig @127.0.0.1 example.com
```

在 fake-ip 模式下，返回 `198.18.0.0/16` 范围内的地址属于正常现象，并不表示解析失败。

### 4. 在物理网卡上抓 53 和 853

macOS Wi-Fi 常见接口为 `en0`。可先使用 `route get default` 或系统信息确认实际接口，再进行抓包：

```bash
sudo tcpdump -ni en0 '(udp port 53) or (tcp port 53) or (tcp port 853)'
```

随后访问若干此前未解析过的域名，并重新运行在线 DNS 泄露测试。

正常情况下，不应看到本机通过物理网卡向路由器、运营商 DNS 或公共 DNS 发送普通 53 查询。国外 DoH 使用 HTTPS 443，因此不会以明文 53 的形式出现。

如果配置允许 853 通过 `🔒 DNS代理`，判断时还需要结合代理链路本身分析，而不能仅依据端口号；关键是确认不存在预期之外的本地直连 DNS 路径。

### 5. 返回在线测试复核结果

可再次使用以下服务交叉验证：

- [BrowserLeaks DNS Leak Test](https://browserleaks.com/dns)；
- [DNSLeakTest](https://www.dnsleaktest.com/)；
- [IPLeak](https://ipleak.net/)；
- [Whoer DNS Leak Test](https://whoer.net/dns-leak-test)；
- [DNSCheck.tools](https://dnscheck.tools/)。

测试结果中出现 Cloudflare、Google 或代理出口附近的 resolver，并不等同于 DNS 泄露；在线检测只能观察最终参与递归解析的服务器。更需要关注的是本地运营商、公司或学校 DNS 是否仍然出现，以及启用代理前后 DNS resolver 是否没有发生预期变化。

## 常见配置错误

以下是实际配置中较常见的错误：

- **系统 DNS 仍指向路由器**：即使 Mihomo 内部 DNS 配置正确，系统查询仍可能在进入 Mihomo 之前完成；
- **只劫持 UDP 53**：TCP DNS 留下一条旁路；
- **只考虑 IPv4**：IPv6 继续直连；
- **国外 `nameserver` 没有指定代理组**：DoH 自身仍可能走 DIRECT；
- **DNS 代理组能够到达 DIRECT**：即使表面使用了代理组，DoH 仍可能经由本地网络直接出站；
- **`direct-nameserver` 二次解析**：破坏 split-DNS 的单一决策点；
- **bootstrap DNS 也依赖域名**：解析 DNS 服务器之前又需要 DNS；
- **`fake-ip-filter: ['*']`**：等同于全局关闭 fake-ip；
- **泄露检测站点被 geosite 误分流**：检测站点本身进入了错误地域策略；
- **Android Private DNS 未关闭**：853 不会因为劫持 53 自动转换为 Mihomo 内置 DNS；
- **BFM TPROXY 与 Mihomo TUN 同时接管**：两套透明代理与路由机制可能发生冲突。

## DNS 防泄露的核心是完整路径控制

DNS 防泄露不应被简化为一份“推荐 DNS 地址列表”。真正需要控制的是从系统查询入口到上游解析器，再到最终网络出口的完整路径。

一套完整的 DNS 防泄露配置应尽量同时满足以下条件：

1. 系统 DNS 的入口确定进入 Mihomo；
2. 应用自己发出的 UDP/TCP 53 也会被接管；
3. IPv4 和 IPv6 使用一致的代理模型；
4. 普通上游 DNS 全部加密；
5. 国外 DNS 的连接本身走受控的非大陆代理出口；
6. 国内/私有域名通过 split-DNS 明确走国内解析，不靠事后二次判断；
7. DoH 域名、DoT 853 和泄露检测站点有前置安全规则；
8. Android 与 Linux 服务器等特殊部署应根据自身网络栈分别处理，而不是直接复用桌面 TUN 配置。

当这些路径形成闭环后，DNS 查询才能真正纳入统一、可验证的代理与解析策略。

如果使用配置生成器，也建议将这些 DNS 相关约束直接写入校验逻辑：一旦模板重新引入明文 DNS、关闭严格路由、使 DNS 组能够到达 `DIRECT`，或者删除关键防泄露规则，应在生成阶段直接报错，而不是在部署后再依赖在线测试发现问题。
