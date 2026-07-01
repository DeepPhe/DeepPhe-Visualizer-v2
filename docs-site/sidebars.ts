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
        'cohort-explorer/patient-dots',
      ],
    },
    {
      type: 'category',
      label: 'Review Patient Results',
      collapsed: false,
      items: [
        'cohort-explorer/understanding-results',
        'cohort-explorer/selected-patients',
        'cohort-explorer/patients-table',
        'cohort-explorer/exporting-results',
      ],
    },
    {
      type: 'category',
      label: 'Explore a Patient',
      collapsed: false,
      items: [
        'explore-patient/overview',
        'explore-patient/standalone-patient-view',
        'explore-patient/cancer-tumor-detail',
        'explore-patient/document-timeline',
        'explore-patient/patient-summary',
        'explore-patient/document-viewer',
      ],
    },
    {
      type: 'category',
      label: 'Customize & Accessibility',
      collapsed: true,
      items: [
        'customization/display-settings',
        'customization/theme-builder',
        'customization/accessibility',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: ['reference/filter-categories', 'reference/troubleshooting'],
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
