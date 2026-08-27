module.exports = function(eleventyConfig) {
  // Pass static assets directly through to the build folder
  eleventyConfig.addPassthroughCopy({
    "src/rw_common/themes/realmacsoftware06/consolidated.css": "assets/css/consolidated.css",
    "src/rw_common/themes/realmacsoftware06/images": "assets/img",
    "src/files": "assets/img"
  });

    
  // Shortcode to display current dynamic year in the footer
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};
