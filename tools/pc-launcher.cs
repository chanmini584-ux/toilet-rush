// TOILET RUSH 실행기 — 서버 없이 동작한다.
// EXE에 내장된 게임 HTML을 %LOCALAPPDATA%\ToiletRush에 풀어 기본 브라우저로 연다.
// 항상 같은 경로에 풀기 때문에 브라우저에 저장되는 최고 기록(LocalStorage)이 유지된다.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        bool selfTest = Array.IndexOf(args, "--self-test") >= 0;
        byte[] html;
        using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("ToiletRush.Game.html"))
        {
            if (resource == null) return 3;
            using (MemoryStream copy = new MemoryStream()) { resource.CopyTo(copy); html = copy.ToArray(); }
        }
        if (selfTest)
        {
            string source = Encoding.UTF8.GetString(html);
            return source.Contains("<!doctype html>") && source.Contains("RushRenderer") && source.Contains("__RUSH_BUNDLED_QA__") ? 0 : 4;
        }
        string file = null;
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ToiletRush");
            Directory.CreateDirectory(dir);
            file = Path.Combine(dir, "ToiletRush.html");
            File.WriteAllBytes(file, html);
            Process.Start(new ProcessStartInfo(file) { UseShellExecute = true });
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show("게임을 열지 못했습니다.\n같은 폴더의 ToiletRush.html을 더블클릭해 주세요.\n\n"
                + (file ?? "") + "\n" + error.Message, "TOILET RUSH", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }
}
