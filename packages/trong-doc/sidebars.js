/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  docs: [
    "intro",
    "howReactivityWorks",
    "transactions",
    "listenQueries",
    {
      type: "category",
      label: "SQLite backends",
      items: [{ type: "autogenerated", dirName: "backends" }],
      collapsed: false,
    },
    {
      type: "category",
      label: "React integration",
      items: [{ type: "autogenerated", dirName: "reactIntegration" }],
    },
    {
      type: "category",
      label: "Building SQL",
      items: [{ type: "autogenerated", dirName: "buildingSql" }],
    },
    {
      type: "category",
      label: "Plugins",
      items: [{ type: "autogenerated", dirName: "plugins" }],
    },
    "deployingToNetlify",
  ],

  // But you can create a sidebar manually
  /*
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Tutorial',
      items: ['hello'],
    },
  ],
   */
};

module.exports = sidebars;
