/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Task configuration.
    eslint: {
      target: ['Lagometer.js'],
      options: {
        config: '.eslintrc'
      }
    },
    jscs: {
      src: ['Lagometer.js'],
      options: {
        config: '.jscsrc'
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-jscs');

  // Default task.
  grunt.registerTask('default', ['eslint', 'jscs']);
};
