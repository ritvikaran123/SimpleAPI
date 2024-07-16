namespace SimpleAPI.Tests;

public class UnitTest1
{
    ValuesController controller = new ValuesController();
    [Fact]
    public void GetReturnsCorrectNumber()
    {
        var returnValue = controller.Get(1);
        Assert.Equal("sandeep", returnValue);
    }
}