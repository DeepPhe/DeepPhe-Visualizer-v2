import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  userGuide: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: ['getting-started/overview', 'getting-started/first-cohort'],
    },
    {
      type: 'category',
      label: 'Build a Cohort',
      collapsed: false,
      items: [
        'cohort-explorer/screen-overview',
        'cohort-explorer/selecting-filters',
        'cohort-explorer/filter-details',
      ],
    },
    {
      type: 'category',
      label: 'Review Patient Results',
      collapsed: false,
      items: [
        'cohort-explorer/understanding-results',
        'cohort-explorer/selected-patients',
      ],
    },
    {
      type: 'category',
      label: 'Explore a Patient',
      collapsed: false,
      items: ['cohort-explorer/viewing-a-patient'],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        'cohort-explorer/exporting-results',
        'customization/display-settings',
        'customization/accessibility',
        'reference/filter-categories',
        'reference/troubleshooting',
      ],
    },
    'printable-guide',
    {
      type: 'category',
      label: 'Contributors',
      collapsed: true,
      items: ['contributors/screenshot-capture'],
    },
  ],
};

export default sidebars;
