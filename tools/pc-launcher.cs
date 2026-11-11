// TOILET RUSH portable Windows launcher. Built with the Windows .NET Framework compiler.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("TOILET RUSH")]
[assembly: AssemblyDescription("집까지 참아라! Offline portable browser game")]
[assembly: AssemblyProduct("TOILET RUSH")]
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: AssemblyFileVersion("1.1.0.0")]

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        bool headless = false;
        bool selfTest = false;
        int port = 41731;
        foreach (string arg in args)
        {
            if (arg == "--headless") headless = true;
            else if (arg == "--self-test") selfTest = true;
            else if (arg.StartsWith("--port="))
            {
                if (!Int32.TryParse(arg.Substring(7), out port) || port < 1024 || port > 65535) return 2;
            }
            else return 2;
        }

        byte[] html;
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("ToiletRush.Game.html"))
        {
            if (resource == null) return 3;
            using (MemoryStream copy = new MemoryStream())
            {
                resource.CopyTo(copy);
                html = copy.ToArray();
            }
        }
        if (selfTest)
        {
            string source = Encoding.UTF8.GetString(html);
            return source.Contains("<!doctype html>") && source.Contains("RushRenderer") && source.Contains("__RUSH_BUNDLED_QA__") ? 0 : 4;
        }

        string url = "http://127.0.0.1:" + port + "/";
        bool created;
        using (Mutex mutex = new Mutex(true, "Local\\ToiletRush.Portable." + port, out created))
        {
            if (!created)
            {
                if (!headless)
                {
                    try { OpenGame(url); }
                    catch (Exception error) { MessageBox.Show("브라우저에서 이 주소를 열어주세요:\n" + url + "\n\n" + error.Message, "TOILET RUSH"); }
                }
                return 0;
            }
            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using (GameContext game = new GameContext(html, port, headless))
                {
                    if (!headless)
                    {
                        try { OpenGame(url); }
                        catch (Exception error) { MessageBox.Show("게임은 실행 중입니다. 브라우저에서 이 주소를 열어주세요:\n" + url + "\n\n" + error.Message, "TOILET RUSH"); }
                    }
                    Application.Run(game);
                }
                return 0;
            }
            catch (Exception error)
            {
                if (!headless) MessageBox.Show("게임을 시작하지 못했습니다.\n\n기존 TOILET RUSH를 종료한 뒤 다시 실행해주세요.\n\n" + error.Message, "TOILET RUSH", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 1;
            }
            finally { mutex.ReleaseMutex(); }
        }
    }

    internal static void OpenGame(string url)
    {
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
}

internal sealed class GameContext : ApplicationContext
{
    private readonly byte[] html;
    private readonly TcpListener listener;
    private readonly NotifyIcon tray;
    private readonly ContextMenuStrip menu;
    private readonly Icon icon;
    private readonly string url;
    private volatile bool stopping;

    internal GameContext(byte[] content, int port, bool headless)
    {
        html = content;
        url = "http://127.0.0.1:" + port + "/";
        listener = new TcpListener(IPAddress.Loopback, port);
        listener.Start(16);
        Thread worker = new Thread(AcceptLoop);
        worker.IsBackground = true;
        worker.Name = "ToiletRush.Loopback";
        worker.Start();
        if (!headless)
        {
            icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            menu = new ContextMenuStrip();
            menu.Items.Add("게임 다시 열기", null, delegate { Reopen(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("게임 완전히 종료", null, delegate { ExitThread(); });
            tray = new NotifyIcon();
            tray.Icon = icon;
            tray.Text = "TOILET RUSH — 집까지 참아라!";
            tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { Reopen(); };
            tray.Visible = true;
            tray.ShowBalloonTip(4500, "TOILET RUSH", "게임을 시작합니다! 완전히 종료하려면 작업 표시줄의 게임 아이콘을 우클릭하세요.", ToolTipIcon.Info);
        }
    }

    private void Reopen()
    {
        try { Program.OpenGame(url); }
        catch (Exception error) { MessageBox.Show("브라우저에서 " + url + " 주소를 열어주세요.\n" + error.Message, "TOILET RUSH"); }
    }

    private void AcceptLoop()
    {
        while (!stopping)
        {
            try
            {
                TcpClient client = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(delegate { Serve(client); });
            }
            catch (SocketException) { if (stopping) return; }
            catch (ObjectDisposedException) { return; }
        }
    }

    private void Serve(TcpClient client)
    {
        using (client)
        {
            try
            {
                client.ReceiveTimeout = 2500;
                client.SendTimeout = 3000;
                using (NetworkStream stream = client.GetStream())
                {
                    byte[] header = new byte[16384];
                    int count = 0;
                    while (count < header.Length)
                    {
                        int next = stream.ReadByte();
                        if (next < 0) return;
                        header[count++] = (byte)next;
                        if (count >= 4 && header[count - 4] == 13 && header[count - 3] == 10 && header[count - 2] == 13 && header[count - 1] == 10) break;
                    }
                    if (count == header.Length) { Respond(stream, 431, "Request Header Fields Too Large", "text/plain", new byte[0], false); return; }
                    string first = Encoding.ASCII.GetString(header, 0, count).Split(new string[] { "\r\n" }, StringSplitOptions.None)[0];
                    string[] request = first.Split(' ');
                    if (request.Length != 3 || !request[2].StartsWith("HTTP/1.")) { Respond(stream, 400, "Bad Request", "text/plain", new byte[0], false); return; }
                    bool isHead = request[0] == "HEAD";
                    if (request[0] != "GET" && !isHead) { Respond(stream, 405, "Method Not Allowed", "text/plain", new byte[0], false); return; }
                    string route = request[1].Split('?')[0];
                    if (route == "/" || route == "/index.html") Respond(stream, 200, "OK", "text/html; charset=utf-8", html, isHead);
                    else if (route == "/favicon.ico") Respond(stream, 204, "No Content", "image/x-icon", new byte[0], isHead);
                    else if (route == "/_rush/health") Respond(stream, 200, "OK", "application/json", Encoding.UTF8.GetBytes("{\"game\":\"toilet-rush\",\"version\":\"1.1.0\"}"), isHead);
                    else Respond(stream, 404, "Not Found", "text/plain", Encoding.UTF8.GetBytes("Not found"), isHead);
                }
            }
            catch (IOException) { }
            catch (SocketException) { }
            catch (ObjectDisposedException) { }
        }
    }

    private static void Respond(NetworkStream stream, int status, string reason, string type, byte[] body, bool head)
    {
        string headers = "HTTP/1.1 " + status + " " + reason + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.Length + "\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n";
        byte[] data = Encoding.ASCII.GetBytes(headers);
        stream.Write(data, 0, data.Length);
        if (!head && body.Length > 0) stream.Write(body, 0, body.Length);
    }

    protected override void ExitThreadCore()
    {
        Cleanup();
        base.ExitThreadCore();
    }

    private void Cleanup()
    {
        if (stopping) return;
        stopping = true;
        listener.Stop();
        if (tray != null) { tray.Visible = false; tray.Dispose(); }
        if (menu != null) menu.Dispose();
        if (icon != null) icon.Dispose();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) Cleanup();
        base.Dispose(disposing);
    }
}
