using System.Globalization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TradeRecon.Application.Reconciliation;
using TradeRecon.Domain;
using TradeRecon.Infrastructure;

namespace TradeRecon.Console;

/// <summary>
/// Console host for the canonical trade-reconciliation baseline. Runs a deterministic
/// end-of-day reconciliation over the synthetic CSV fixtures and writes the reports.
///
/// Usage: TradeRecon.Console [--date yyyy-MM-dd] [--fixtures &lt;dir&gt;] [--out &lt;dir&gt;]
/// </summary>
public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        var options = CliOptions.Parse(args);

        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.SetMinimumLevel(LogLevel.Information);
            builder.AddSimpleConsole(o =>
            {
                o.SingleLine = true;
                o.TimestampFormat = "HH:mm:ss ";
            });
        });

        var services = new ServiceCollection();
        services.AddSingleton<ILoggerFactory>(loggerFactory);
        services.AddLogging();
        services.AddTradeReconCore();
        services.AddTradeReconInfrastructure(options.FixturesDirectory, options.OutputDirectory);

        await using var provider = services.BuildServiceProvider();
        var logger = provider.GetRequiredService<ILogger<object>>();
        var runner = provider.GetRequiredService<ReconciliationRunner>();

        var runOptions = new ReconciliationRunOptions
        {
            Tolerances = new ToleranceOptions
            {
                QuantityAbsolute = 0m,
                AmountAbsolute = 0.01m,
                SettlementDateDays = 0,
                PositionQuantityAbsolute = 0m
            }
        };

        try
        {
            var result = await runner.RunAsync(options.BusinessDate, runOptions).ConfigureAwait(false);

            System.Console.WriteLine();
            System.Console.WriteLine($"Business date : {result.BusinessDate:yyyy-MM-dd}");
            System.Console.WriteLine($"Matched pairs : {result.Matches.Count}");
            System.Console.WriteLine($"Open breaks   : {result.OpenBreaks.Count}");
            System.Console.WriteLine($"Overridden    : {result.OverriddenBreaks.Count}");
            System.Console.WriteLine($"Status        : {(result.IsClean ? "CLEAN" : "BREAKS OUTSTANDING")}");
            System.Console.WriteLine($"Reports       : {options.OutputDirectory}");

            return result.IsClean ? 0 : 2;
        }
        catch (FileNotFoundException ex)
        {
            logger.LogError(ex, "Fixture file missing. Check --fixtures path.");
            return 1;
        }
    }

    private sealed record CliOptions(DateOnly BusinessDate, string FixturesDirectory, string OutputDirectory)
    {
        public static CliOptions Parse(string[] args)
        {
            var date = new DateOnly(2024, 6, 3);
            var baseDir = AppContext.BaseDirectory;
            var fixtures = Path.GetFullPath(Path.Combine(baseDir, "fixtures"));
            var output = Path.GetFullPath(Path.Combine(baseDir, "reports"));

            for (var i = 0; i < args.Length - 1; i++)
            {
                switch (args[i])
                {
                    case "--date":
                        date = DateOnly.ParseExact(args[++i], "yyyy-MM-dd", CultureInfo.InvariantCulture);
                        break;
                    case "--fixtures":
                        fixtures = Path.GetFullPath(args[++i]);
                        break;
                    case "--out":
                        output = Path.GetFullPath(args[++i]);
                        break;
                }
            }

            return new CliOptions(date, fixtures, output);
        }
    }
}
