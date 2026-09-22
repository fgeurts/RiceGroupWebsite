module.exports = function(eleventyConfig) {
  // Pass static assets directly through to the build folder
  eleventyConfig.addPassthroughCopy({
    "src/rw_common/themes/realmacsoftware06/consolidated.css": "assets/css/consolidated.css",
    "src/rw_common/themes/realmacsoftware06/images": "assets/img",
    "src/files": "assets/img",
    "src/news/files": "news/files",
    "src/outreach/files": "outreach/files"
  });

  // Outreach keeps its images next to the pages that use them
  eleventyConfig.addPassthroughCopy("src/outreach/**/*.{jpg,jpeg,png,gif,pdf}");
    
  // Custom date filter for Nunjucks templates
  eleventyConfig.addFilter("date", (dateObj, format = "%b %d, %Y") => {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return dateObj;

    // Handle common formats used in archive.njk
    if (format === "%b %d") {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  });

  // Shortcode to display current dynamic year in the footer
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Collection to group posts by year
  eleventyConfig.addCollection("postsByYear", (collectionApi) => {
    const posts = collectionApi.getFilteredByTag("news").reverse();
    const years = {};

    posts.forEach((post) => {
      const year = post.date.getFullYear();
      if (!years[year]) {
        years[year] = [];
      }
      years[year].push(post);
    });

    return Object.keys(years).map((year) => ({
      year: year,
      posts: years[year]
    }));
  });

  // Specify input and includes directories
  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    }
  };
};
