module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/step-definitions/**/*.ts'],
    format: ['progress-bar', 'json:reports/cucumber.json'],
    publishQuiet: true,
    strict: false,
  },
};
