import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type {EditUrlFunction} from '@docusaurus/plugin-content-docs';

const organizationName = 'DeepPhe';
const projectName = 'DeepPhe-Visualizer-v2';
const repositoryUrl = `https://github.com/${organizationName}/${projectName}`;
const editUrl: EditUrlFunction = ({docPath}) =>
  `${repositoryUrl}/edit/main/docs/${docPath}`;

const config: Config = {
  title: 'DeepPhe Visualizer User Guide',
  tagline: 'Build and explore patient cohorts with DeepPhe',
  url: 'https://deepphe.github.io',
  baseUrl: '/DeepPhe-Visualizer-v2/',
  trailingSlash: false,

  organizationName: 'DeepPhe',
  projectName: 'DeepPhe-Visualizer-v2',
  onBrokenLinks: 'throw',

  future: {
    v4: true,
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mdx1Compat: {
      comments: true,
      admonitions: true,
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'DeepPhe Visualizer',
      logo: {
        alt: 'DeepPhe',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'userGuide',
          position: 'left',
          label: 'User Guide',
        },
        {
          href: repositoryUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'DeepPhe',
          items: [
            {
              label: 'Visualizer repository',
              href: repositoryUrl,
            },
            {
              label: 'Printable guide',
              to: '/printable-guide/',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} DeepPhe.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
