"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, Copy, Download, HardDrive, KeyRound, PackageOpen, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SharedPackage = {
  id: string; name: string; uploader: string; note: string; game_version: string;
  size_bytes: number; total_parts: number; sha256: string; download_count: number; created_at: number;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024 ** 2) return `${Math.ceil(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

export function WowSyncApp() {
  const [invite, setInvite] = useState("");
  const [acceptedCode, setAcceptedCode] = useState("");
  const [packages, setPackages] = useState<SharedPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const loadPackages = useCallback(async (code: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/packages", { headers: { "X-Invite-Code": code } });
      const data = (await response.json()) as { packages?: SharedPackage[]; error?: string };
      if (!response.ok) throw new Error(data.error || "读取配置包失败");
      setPackages(data.packages ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取配置包失败");
    } finally { setLoading(false); }
  }, []);

  async function enterVault(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const code = invite.trim();
      const response = await fetch("/api/access", { method: "POST", headers: { "X-Invite-Code": code } });
      if (!response.ok) throw new Error("邀请码不正确，请向队友确认");
      sessionStorage.setItem("wowsync-invite", code);
      setAcceptedCode(code);
      await loadPackages(code);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法进入配置站"); setLoading(false);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("wowsync-invite");
    if (saved) { setInvite(saved); setAcceptedCode(saved); void loadPackages(saved); }
  }, [loadPackages]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "list_ready_wow_packages",
      title: "列出可用魔兽配置包",
      description: "使用当前已验证的邀请码刷新并返回可恢复的 Retail 配置包。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute() {
        if (!acceptedCode) throw new Error("请先在页面输入邀请码");
        const response = await fetch("/api/packages", { headers: { "X-Invite-Code": acceptedCode } });
        if (!response.ok) throw new Error("读取配置包失败");
        const data = (await response.json()) as { packages: SharedPackage[] };
        setPackages(data.packages);
        return { packages: data.packages.map((item) => ({ id: item.id, name: item.name, uploader: item.uploader, sizeBytes: item.size_bytes })) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [acceptedCode]);

  async function copyId(id: string) {
    await navigator.clipboard.writeText(id); setCopied(id); window.setTimeout(() => setCopied(""), 1600);
  }

  const newest = useMemo(() => packages[0]?.created_at ?? null, [packages]);

  if (!acceptedCode) {
    return (
      <main className="gate-shell">
        <section className="gate-panel">
          <div className="brand-lockup"><span className="brand-rune">A</span><span>艾泽拉斯配置站</span></div>
          <div className="gate-copy">
            <Badge variant="outline" className="gold-badge"><ShieldCheck /> 固定队伍专用</Badge>
            <h1>换台电脑，<br />不用重练手感。</h1>
            <p>保存正式服插件、按键与界面设置，在另一台 Windows 设备上一键恢复。</p>
          </div>
          <form className="invite-form" onSubmit={enterVault}>
            <label htmlFor="invite"><KeyRound /> 输入队伍邀请码</label>
            <div className="invite-row">
              <Input id="invite" value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="例如：M+FRIENDS-2026" autoComplete="off" required />
              <Button type="submit" disabled={loading}>{loading ? "验证中…" : "进入配置站"}</Button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
          <div className="gate-points">
            <span><Archive /> 完整 AddOns + WTF</span><span><ShieldCheck /> 恢复前自动备份</span><span><HardDrive /> 64 MB 分片传输</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup"><span className="brand-rune">A</span><span>艾泽拉斯配置站</span><Badge variant="outline">Retail</Badge></div>
        <div className="header-actions">
          <Button variant="ghost" size="sm" onClick={() => void loadPackages(acceptedCode)} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />刷新</Button>
          <Button variant="outline" size="sm" onClick={() => { sessionStorage.removeItem("wowsync-invite"); setAcceptedCode(""); setPackages([]); }}>退出</Button>
        </div>
      </header>

      <section className="dashboard-heading">
        <div><p className="kicker">YOUR PARTY VAULT</p><h1>队伍配置库</h1><p>采集、分享，并在新设备恢复熟悉的战斗界面。</p></div>
        <a className="download-kit" href="/downloads/WoWSync-Windows.zip" download><Download /><span><strong>下载 Windows 工具包</strong><small>上传与恢复脚本 · ZIP</small></span></a>
      </section>

      <Alert className="privacy-alert">
        <ShieldCheck /><AlertTitle>只分享给信任的队友</AlertTitle>
        <AlertDescription>配置包包含 WTF 文件夹，可能暴露战网账号目录名、服务器名、角色名以及插件保存的数据。上传前脚本会再次确认。</AlertDescription>
      </Alert>

      <Tabs defaultValue="library" className="vault-tabs">
        <TabsList>
          <TabsTrigger value="library"><PackageOpen />配置库</TabsTrigger>
          <TabsTrigger value="upload"><UploadCloud />上传我的配置</TabsTrigger>
          <TabsTrigger value="restore"><Download />新设备恢复</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="tab-panel">
          <div className="panel-title"><div><h2>可用配置包</h2><p>{packages.length} 个完整备份{newest ? ` · 最近更新 ${new Date(newest).toLocaleDateString("zh-CN")}` : ""}</p></div></div>
          {error && <Alert variant="destructive"><AlertTitle>读取失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {!loading && packages.length === 0 ? (
            <div className="empty-vault"><PackageOpen /><h3>队伍配置库还是空的</h3><p>下载工具包，运行“上传我的配置”，第一个配置包就会出现在这里。</p></div>
          ) : (
            <div className="package-grid">
              {packages.map((item) => (
                <Card key={item.id} className="package-card">
                  <CardHeader>
                    <div className="package-meta"><Badge>{item.game_version === "retail" ? "正式服" : item.game_version}</Badge><span>{formatBytes(item.size_bytes)}</span></div>
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription>由 {item.uploader} 上传 · {new Date(item.created_at).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {item.note && <p className="package-note">{item.note}</p>}
                    <div className="package-code"><code>{item.id}</code><Button variant="ghost" size="icon-sm" onClick={() => void copyId(item.id)} aria-label="复制配置包编号">{copied === item.id ? <Check /> : <Copy />}</Button></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="upload" className="tab-panel instruction-layout">
          <div><p className="step-number">01</p><h2>采集并上传</h2><p>工具会自动查找 <code>_retail_</code>，只打包 <code>Interface</code> 和 <code>WTF</code>，再按 64 MB 分片上传。</p></div>
          <ol className="steps">
            <li><span>1</span><div><strong>完全退出魔兽世界</strong><p>脚本检测到 Wow.exe 仍在运行时会停止，避免配置文件没有写盘。</p></div></li>
            <li><span>2</span><div><strong>解压并双击“上传我的配置.cmd”</strong><p>按提示输入本页地址、邀请码和配置包名称。</p></div></li>
            <li><span>3</span><div><strong>确认隐私提示</strong><p>成功后会显示配置包编号，并自动清理本地临时压缩包。</p></div></li>
          </ol>
        </TabsContent>
        <TabsContent value="restore" className="tab-panel instruction-layout">
          <div><p className="step-number">02</p><h2>在新设备恢复</h2><p>恢复工具会校验 SHA-256，并先把现有 <code>Interface</code> 与 <code>WTF</code> 移入带时间戳的备份目录。</p></div>
          <ol className="steps">
            <li><span>1</span><div><strong>安装并启动一次正式服</strong><p>让游戏创建新的 <code>_retail_</code> 文件夹，然后完全退出游戏。</p></div></li>
            <li><span>2</span><div><strong>复制配置包编号</strong><p>在配置库中找到队友的配置，点击编号旁的复制按钮。</p></div></li>
            <li><span>3</span><div><strong>双击“一键恢复配置.cmd”</strong><p>输入编号并确认目标目录。出现问题时，可把备份目录改回原名。</p></div></li>
          </ol>
        </TabsContent>
      </Tabs>
      <footer><span>艾泽拉斯配置站 · Retail / Windows</span><span>非暴雪官方产品。请只上传你有权分享的插件与配置。</span></footer>
    </main>
  );
}

declare global {
  interface Document {
    readonly modelContext?: { registerTool(tool: Record<string, unknown>, options?: { signal?: AbortSignal }): void | Promise<void> };
  }
}
