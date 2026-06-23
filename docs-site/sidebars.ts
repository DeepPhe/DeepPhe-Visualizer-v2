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
      label: 'Cohort Explorer',
      collapsed: false,
      items: [
        'cohort-explorer/screen-overview',
        'cohort-explorer/selecting-filters',
        'cohort-explorer/filter-details',
        'cohort-explorer/understanding-results',
        'cohort-explorer/selected-patients',
        'cohort-explorer/viewing-a-patient',
        'cohort-explorer/exporting-results',
      ],
    },
    {
      type: 'category',
      label: 'Display and Accessibility',
      items: [
        'customization/display-settings',
        'customization/accessibility',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
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
