using TradeRecon.Console;
using Xunit;

namespace TradeRecon.Tests;

public class CliContractTests
{
    [Theory]
    [InlineData("--date", "not-a-date")]
    [InlineData("--unknown", "value")]
    public async Task InvalidArguments_ReturnDocumentedErrorCode(string option, string value)
    {
        var exitCode = await Program.Main([option, value]);

        Assert.Equal(Program.ExitError, exitCode);
    }

    [Fact]
    public async Task MissingArgumentValue_ReturnsDocumentedErrorCode()
    {
        var exitCode = await Program.Main(["--fixtures"]);

        Assert.Equal(Program.ExitError, exitCode);
    }
}
