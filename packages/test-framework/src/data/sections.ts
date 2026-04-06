import type { SurveySection } from '@/types'

export const surveySections: SurveySection[] = [
  // ── Section 1: Welcome ──
  {
    id: 'welcome',
    title: 'Welcome',
    description:
      'Thanks for testing the Query Designer! A few quick questions about you, then we\'ll jump in. Should take about 10 minutes.',
    questions: [
      {
        id: 'name',
        type: 'text',
        label: 'Your Name',
        placeholder: 'Enter your name (optional)',
        required: false,
      },
      {
        id: 'role',
        type: 'text',
        label: 'Your Role / Title',
        placeholder: 'e.g. Report Developer, DBA, Analyst',
        required: true,
      },
      {
        id: 'sql-experience',
        type: 'choice',
        label: 'What is your experience level with SQL / databases?',
        options: ['None', 'Beginner', 'Intermediate', 'Advanced'],
        required: true,
      },
      {
        id: 'old-qd-experience',
        type: 'choice',
        label: 'How much experience do you have with the old Informer Query Designer?',
        options: ['Never used it', 'Used it a few times', 'Use it regularly'],
        required: true,
      },
    ],
  },

  // ── Section 2: Build a Query ──
  {
    id: 'build-query',
    title: 'Build a Query',
    description:
      'Build a query, apply filters, sort the results, and save your work.',
    questions: [
      {
        id: 'build-query-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'Open the Query Designer and choose the Northwind datasource.',
          'Select the "public.orders" table, then add columns: order_id, customer_id, order_date, freight.',
          'Add a filter: freight greater than 50. Try adding a second filter and switching between AND/OR.',
          'Sort by order_date descending and set a row limit of 50.',
          'Preview the results, then save with Ctrl+S (or Cmd+S).',
          'Copy or export the SQL, then reopen the saved query to confirm everything persisted.',
        ],
      },
      {
        id: 'build-query-ease',
        type: 'rating',
        label: 'How easy was the overall query-building experience?',
        description: '1 = Very Difficult, 5 = Very Easy',
        required: true,
      },
      {
        id: 'build-query-navigation',
        type: 'rating',
        label: 'How easy was it to find the features you needed (columns, filters, sort, save)?',
        description: '1 = Very Difficult, 5 = Found everything immediately',
        required: true,
      },
      {
        id: 'build-query-feedback',
        type: 'textarea',
        label: 'What was confusing or could be improved?',
        placeholder: 'Anything that slowed you down or felt unclear\u2026',
      },
    ],
  },

  // ── Section 3: Natural Language Query ──
  {
    id: 'nl-query',
    title: 'Natural Language Query',
    description:
      'Try the AI-powered natural language feature.',
    questions: [
      {
        id: 'nl-query-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'With Northwind selected, enable the Beta AI toggle in the toolbar.',
          'In the natural language bar, type: "Show me all orders shipped to France with freight over 30, sorted by order date"',
          'Review the generated query, then try one of your own.',
        ],
      },
      {
        id: 'nl-query-usefulness',
        type: 'rating',
        label: 'How useful is this feature compared to building the query manually?',
        description: '1 = Not Useful, 5 = Extremely Useful',
        required: true,
      },
      {
        id: 'nl-query-feedback',
        type: 'textarea',
        label: 'Any suggestions for the AI feature?',
        placeholder: 'Ideas, issues, or things it got wrong\u2026',
      },
    ],
  },

  // ── Section 4: Joins & Sub-selects ──
  {
    id: 'joins-subselects',
    title: 'Joins & Sub-selects',
    description:
      'Connect tables with joins and create a sub-select stage.',
    questions: [
      {
        id: 'joins-subselects-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'From your orders query, go to the Joins tab and click a suggested join (e.g. + customers). Add a column from the joined table.',
          'Try a manual join: click "Add related data", pick a table, and set matching columns yourself.',
          'Go to the Sub-selects tab, create a new stage (e.g. "freight_summary"), add customer_id and a SUM(freight) summarization.',
          'Preview the results at each step.',
        ],
      },
      {
        id: 'joins-ease',
        type: 'rating',
        label: 'How easy was it to add joins?',
        description: '1 = Very Difficult, 5 = Very Easy',
        required: true,
      },
      {
        id: 'subselects-intuitive',
        type: 'rating',
        label: 'How intuitive was creating sub-selects?',
        description: '1 = Very Confusing, 5 = Very Intuitive',
        required: true,
      },
      {
        id: 'joins-subselects-feedback',
        type: 'textarea',
        label: 'Feedback on joins or sub-selects?',
        placeholder: 'What worked well or could be improved\u2026',
      },
    ],
  },

  // ── Section 5: Comparison ──
  {
    id: 'comparison',
    title: 'Comparison with Old Query Designer',
    description:
      'If you\'ve used the old Informer Query Designer, how does the new one compare?',
    questions: [
      {
        id: 'comparison-preference',
        type: 'choice',
        label: 'Which do you prefer overall?',
        options: [
          'New Query Designer',
          'Old Query Designer',
          'About the same',
          'Haven\'t used the old one',
        ],
        required: false,
      },
      {
        id: 'comparison-improvement',
        type: 'rating',
        label: 'Overall, the new Query Designer is an improvement over the old one.',
        description: '1 = Strongly Disagree, 5 = Strongly Agree',
      },
      {
        id: 'comparison-old-better',
        type: 'textarea',
        label: 'What does the old Query Designer do better?',
        placeholder: 'Be specific if you can\u2026',
      },
    ],
  },

  // ── Section 6: Final Feedback ──
  {
    id: 'final-feedback',
    title: 'Final Feedback',
    description:
      'Almost done! A few last questions.',
    questions: [
      {
        id: 'favorite-feature',
        type: 'textarea',
        label: 'What was your favorite feature?',
        placeholder: 'What stood out to you\u2026',
      },
      {
        id: 'most-improve',
        type: 'textarea',
        label: 'What needs the most improvement?',
        placeholder: 'What needs the most work\u2026',
      },
      {
        id: 'other-comments',
        type: 'textarea',
        label: 'Any other comments?',
        placeholder: 'Anything else you\'d like to share\u2026',
      },
      {
        id: 'overall-rating',
        type: 'rating',
        label: 'Overall, how would you rate the new Query Designer?',
        description: '1 = Very Poor, 5 = Excellent',
        required: true,
      },
    ],
  },

  // ── Thank You ──
  {
    id: 'thank-you',
    title: 'Thank You',
    description:
      'Your feedback has been recorded \u2014 thank you! You can revisit this page anytime to update your responses.',
    questions: [],
  },
]
