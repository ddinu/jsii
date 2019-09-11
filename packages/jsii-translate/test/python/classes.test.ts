import { expectPython } from "./python";

test('class declaration with fields and constructor', async () => {
  await expectPython(`
  class MyClass {
    private readonly x: string;

    constructor(y: string) {
      this.x = y;
    }
  }
  `, `
  class MyClass:
      def __init__(self, y):
          self.x = y
  `);
});

test('class with implicit declaration', async () => {
  await expectPython(`
  class MyClass {
    private readonly x = 'bloep';
  }
  `, `
  class MyClass:
      def __init__(self):
          self.x = 'bloep'
  `);
});

test('class with inheritance', async () => {
  await expectPython(`
  class MyClass extends cdk.SomeOtherClass {
  }
  `, `
  class MyClass(cdk.SomeOtherClass):
      pass
  `);
});

test('class with method', async () => {
  await expectPython(`
  class MyClass extends cdk.SomeOtherClass {
    public someMethod(x: string) {
      console.log(x);
    }
  }
  `, `
  class MyClass(cdk.SomeOtherClass):
      def some_method(self, x):
          print(x)
  `);
});