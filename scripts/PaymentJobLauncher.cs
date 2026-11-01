using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// Compile as WindowsApplication (GUI subsystem), not a console executable.
// No PowerShell, cmd, shell association, user-supplied script or raw output logs.
internal static class PaymentJobLauncher
{
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();

    private static string Quote(string value)
    {
        if (value.IndexOf('"') >= 0 || value.IndexOf('\r') >= 0 || value.IndexOf('\n') >= 0)
            throw new ArgumentException("Invalid path");
        return "\"" + value + "\"";
    }

    private static int Main(string[] args)
    {
        bool smoke = args.Length == 2 && args[1] == "--self-test";
        string root = Directory.GetParent(AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar)).Parent.FullName;
        string started = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        string error = "LAUNCH_CONFIGURATION_INVALID";
        int exit = 1;
        try
        {
            if ((args.Length != 1 && !smoke) || !Path.IsPathRooted(args[0]) ||
                !String.Equals(Path.GetFileName(args[0]), "node.exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(args[0]))
                throw new ArgumentException("Invalid Node path");
            string runner = Path.Combine(root, smoke ? "tests/fixtures/payment-launcher-smoke.mjs" : "scripts/reconcile-payments.mjs");
            string loader = Path.Combine(root, "node_modules/tsx/dist/loader.mjs");
            if (!File.Exists(runner) || !File.Exists(loader)) throw new FileNotFoundException();
            ProcessStartInfo start = new ProcessStartInfo {
                FileName = args[0], Arguments = "--import " + Quote(new Uri(loader).AbsoluteUri) + " " + Quote(runner),
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true
            };
            error = "CHILD_START_FAILED";
            using (Process child = new Process())
            {
                child.StartInfo = start;
                // Drain both pipes concurrently; discard raw provider/DB/runtime output.
                child.OutputDataReceived += delegate { };
                child.ErrorDataReceived += delegate { };
                child.Start();
                child.BeginOutputReadLine(); child.BeginErrorReadLine();
                error = "CHILD_EXECUTION_FAILED";
                child.WaitForExit();
                exit = child.ExitCode == 0 ? 0 : child.ExitCode == 2 ? 2 : 1;
                error = exit == 0 ? "NONE" : exit == 2 ? "PAYMENTS_UNCONFIRMED" : "CHILD_EXIT_FAILED";
            }
        }
        catch { exit = 1; } // Never show exception dialogs, paths, env or raw child output.
        try
        {
            string local = Path.Combine(root, ".local"); Directory.CreateDirectory(local);
            string file = Path.Combine(local, smoke ? "payment-launcher-self-test.json" : "payment-launcher-last.json");
            string temporary = file + "." + Guid.NewGuid().ToString("N") + ".tmp";
            string json = "{\"startedAt\":\"" + started + "\",\"completedAt\":\"" + DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture) +
                "\",\"mode\":\"" + (smoke ? "SELF_TEST" : "PAYMENT_JOB") + "\",\"exitCode\":" + exit +
                ",\"code\":\"" + error + "\",\"consoleAttached\":" + (GetConsoleWindow() == IntPtr.Zero ? "false" : "true") + "}\n";
            File.WriteAllText(temporary, json, new UTF8Encoding(false));
            if (File.Exists(file)) File.Replace(temporary, file, null); else File.Move(temporary, file);
        }
        catch { exit = 1; } // Scheduler exit code still signals a logging/write failure.
        return exit;
    }
}
