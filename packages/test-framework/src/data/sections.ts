import type { SurveySection } from '@/types'

export const surveySections: SurveySection[] = [
  // ── Section 1: Welcome / Info ──
  {
    id: 'welcome',
    title: 'Welcome',
    description:
      'Thank you for participating in the Query Designer usability test. Please tell us a bit about yourself before we begin. This survey should take approximately 20\u201330 minutes.',
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

  // ── Section 2: Standard Query Task ──
  {
    id: 'standard-query',
    title: 'Standard Query',
    description:
      'In this task you will build a basic query using the visual Query Designer interface. Follow the steps below, then answer the questions.',
    questions: [
      {
        id: 'standard-query-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'Open the Query Designer and choose the Northwind datasource.',
          'Select the "public.orders" table from the table list.',
          'Go to the Columns tab and add these columns: order_id, customer_id, order_date, freight.',
          'Go to the Filters tab and add a filter: freight greater than 50.',
          'Click the Preview button on the Home tab to run the query and inspect the results.',
        ],
      },
      {
        id: 'standard-query-ease',
        type: 'rating',
        label: 'How easy was it to build this query?',
        description: '1 = Very Difficult, 5 = Very Easy',
        required: true,
      },
      {
        id: 'standard-query-clarity',
        type: 'rating',
        label: 'How clear were the column / field labels?',
        description: '1 = Very Unclear, 5 = Very Clear',
        required: true,
      },
      {
        id: 'standard-query-find-buttons',
        type: 'rating',
        label: 'How easy was it to find the buttons you needed (Choose source, Columns, Filters, Preview)?',
        description: '1 = Very Difficult to find, 5 = Found everything immediately',
        required: true,
      },
      {
        id: 'standard-query-confusion',
        type: 'textarea',
        label: 'What was confusing, if anything?',
        placeholder: 'Describe anything that was unclear or difficult\u2026',
      },
    ],
  },

  // ── Section 3: Natural Language Query Task ──
  {
    id: 'nl-query',
    title: 'Natural Language Query',
    description:
      'Try the AI-powered natural language feature to generate a query from a plain English description.',
    questions: [
      {
        id: 'nl-query-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'Make sure you have a datasource selected (use Northwind if you haven\'t already).',
          'Enable the Beta AI toggle in the top toolbar.',
          'In the natural language bar that appears, type: "Show me all orders shipped to France with freight over 30, sorted by order date"',
          'Review the generated SQL and the visual query that appears.',
          'Try a second query of your own choosing.',
        ],
      },
      {
        id: 'nl-query-understanding',
        type: 'rating',
        label: 'How well did the AI understand your request?',
        description: '1 = Did Not Understand, 5 = Understood Perfectly',
        required: true,
      },
      {
        id: 'nl-query-usefulness',
        type: 'rating',
        label: 'How useful is the natural language feature compared to building the query manually?',
        description: '1 = Not Useful, 5 = Extremely Useful',
        required: true,
      },
      {
        id: 'nl-query-suggestions',
        type: 'textarea',
        label: 'Any suggestions for the AI feature?',
        placeholder: 'Ideas for improving the natural language experience\u2026',
      },
    ],
  },

  // ── Section 4: Sub-select Task ──
  {
    id: 'sub-select',
    title: 'Sub-selects',
    description:
      'Create a sub-select (nested query) that builds on a main query to test the multi-stage query building experience.',
    questions: [
      {
        id: 'sub-select-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'Start with a main query on the Northwind "public.orders" table with columns: customer_id, freight.',
          'Go to the Sub-selects tab and click "New" to create a new stage.',
          'Give it a name like "freight_summary" and click "Create stage".',
          'In the new stage, add customer_id as a column and add a SUM(freight) summarization.',
          'Run the preview to verify the sub-select results.',
        ],
      },
      {
        id: 'sub-select-intuitive',
        type: 'rating',
        label: 'How intuitive was creating sub-selects?',
        description: '1 = Very Confusing, 5 = Very Intuitive',
        required: true,
      },
      {
        id: 'sub-select-relationship',
        type: 'rating',
        label: 'How clear was the relationship between stages?',
        description: '1 = Very Unclear, 5 = Very Clear',
        required: true,
      },
      {
        id: 'sub-select-comments',
        type: 'textarea',
        label: 'Comments on the sub-select feature?',
        placeholder: 'Share your thoughts on the sub-select experience\u2026',
      },
    ],
  },

  // ── Section 5: Joins Task ──
  {
    id: 'joins',
    title: 'Joins',
    description:
      'Add a join to connect two tables. Try both the suggested joins and adding a manual join.',
    questions: [
      {
        id: 'joins-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'Start a query on the Northwind "public.orders" table.',
          'Go to the Joins tab and look for suggested related tables.',
          'Click a suggested join (e.g. + customers) to auto-connect the tables.',
          'Add columns from the joined table (e.g. company_name from customers).',
          'Now try a manual join: click "Add related data", pick a different table, and set the matching columns yourself.',
          'Preview the results to verify both joins worked.',
        ],
      },
      {
        id: 'joins-ease',
        type: 'rating',
        label: 'How easy was it to add a join using the suggested joins?',
        description: '1 = Very Difficult, 5 = Very Easy',
        required: true,
      },
      {
        id: 'joins-manual-ease',
        type: 'rating',
        label: 'How easy was it to add a manual join by selecting tables and columns yourself?',
        description: '1 = Very Difficult, 5 = Very Easy',
        required: true,
      },
      {
        id: 'joins-suggestions-helpful',
        type: 'rating',
        label: 'How helpful were the suggested joins?',
        description: '1 = Not Helpful, 5 = Very Helpful',
        required: true,
      },
      {
        id: 'joins-feedback',
        type: 'textarea',
        label: 'Any feedback on the join experience?',
        placeholder: 'What worked well or could be improved\u2026',
      },
    ],
  },

  // ── Section 6: Sort, Filter & Limit Task ──
  {
    id: 'sort-filter-limit',
    title: 'Sort, Filter & Limit',
    description:
      'Explore the sorting, filtering, and row limit features of the Query Designer.',
    questions: [
      {
        id: 'sfl-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'Using your Northwind query, go to the Sort & Limit tab.',
          'Click "Sort/Limit" and sort by order_date descending.',
          'Set a row limit of 50.',
          'Go to the Filters tab and add a second filter condition (e.g. customer_id contains "A").',
          'Switch the logic between AND and OR to see how results change.',
          'Preview the results after each change.',
        ],
      },
      {
        id: 'sfl-sort-limit',
        type: 'rating',
        label: 'How intuitive were the sort and limit controls?',
        description: '1 = Very Confusing, 5 = Very Intuitive',
        required: true,
      },
      {
        id: 'sfl-filters',
        type: 'rating',
        label: 'How easy was it to combine multiple filters with AND/OR?',
        description: '1 = Very Difficult, 5 = Very Easy',
        required: true,
      },
      {
        id: 'sfl-filter-labels',
        type: 'rating',
        label: 'How clear were the filter operator labels ("is exactly", "contains", "is blank", etc.)?',
        description: '1 = Very Confusing, 5 = Very Clear',
        required: true,
      },
      {
        id: 'sfl-feedback',
        type: 'textarea',
        label: 'Any feedback on filters / sorting?',
        placeholder: 'Share your experience with these features\u2026',
      },
    ],
  },

  // ── Section 7: Save & Export Task ──
  {
    id: 'save-export',
    title: 'Save & Export',
    description:
      'Test saving your work and exporting the generated SQL.',
    questions: [
      {
        id: 'save-export-instructions',
        type: 'instructions',
        label: 'Steps to complete',
        steps: [
          'Save your query using Ctrl+S (or Cmd+S) or the Save button in the top bar.',
          'On the Home tab, click "Copy SQL" to copy the generated SQL to your clipboard.',
          'Click "Export SQL" to download the SQL as a .sql file.',
          'Click the back arrow to return to the query list and verify your query appears.',
          'Re-open the saved query and confirm all your columns, filters, and joins are still there.',
        ],
      },
      {
        id: 'save-export-convenience',
        type: 'rating',
        label: 'How convenient was the save experience?',
        description: '1 = Very Inconvenient, 5 = Very Convenient',
        required: true,
      },
      {
        id: 'save-export-reload',
        type: 'rating',
        label: 'Did your saved query reload correctly with all settings intact?',
        description: '1 = Nothing loaded, 5 = Everything loaded perfectly',
        required: true,
      },
      {
        id: 'save-export-usefulness',
        type: 'rating',
        label: 'How useful is the SQL export feature?',
        description: '1 = Not Useful, 5 = Very Useful',
        required: true,
      },
      {
        id: 'save-export-comments',
        type: 'textarea',
        label: 'Comments on save / export?',
        placeholder: 'Any feedback on saving or exporting\u2026',
      },
    ],
  },

  // ── Section 8: Comparison with Old Query Designer ──
  {
    id: 'comparison',
    title: 'Comparison with Old Query Designer',
    description:
      'If you have used the old Informer Query Designer, please compare it with the new one on each specific area below. If you have not used the old one, select "Haven\'t used the old one" and skip the ratings.',
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
        id: 'comparison-column-selection',
        type: 'rating',
        label: 'Selecting columns is easier in the new Query Designer than the old one.',
        description: '1 = Strongly Disagree, 5 = Strongly Agree',
      },
      {
        id: 'comparison-filter-building',
        type: 'rating',
        label: 'Building filters (WHERE clauses) is easier in the new Query Designer.',
        description: '1 = Strongly Disagree, 5 = Strongly Agree',
      },
      {
        id: 'comparison-join-experience',
        type: 'rating',
        label: 'Adding joins is easier in the new Query Designer.',
        description: '1 = Strongly Disagree, 5 = Strongly Agree',
      },
      {
        id: 'comparison-navigation',
        type: 'rating',
        label: 'The ribbon tab layout (Home, Columns, Filters, Joins, etc.) is easier to navigate than the old interface.',
        description: '1 = Strongly Disagree, 5 = Strongly Agree',
      },
      {
        id: 'comparison-professional',
        type: 'rating',
        label: 'The new Query Designer looks more professional and polished.',
        description: '1 = Strongly Disagree, 5 = Strongly Agree',
      },
      {
        id: 'comparison-old-better',
        type: 'textarea',
        label: 'What specific tasks does the old Query Designer handle better?',
        placeholder: 'Be specific: e.g. "Adding multiple filters was faster because..." or "The old join UI showed the schema more clearly..."',
      },
      {
        id: 'comparison-new-better',
        type: 'textarea',
        label: 'What specific tasks does the new Query Designer handle better?',
        placeholder: 'Be specific: e.g. "The suggested joins saved me time..." or "The SQL preview helped me verify..."',
      },
    ],
  },

  // ── Section 9: Open-Ended Feedback ──
  {
    id: 'open-ended',
    title: 'Open-Ended Feedback',
    description:
      'Please share any additional thoughts. All fields are optional but greatly appreciated.',
    questions: [
      {
        id: 'favorite-feature',
        type: 'textarea',
        label: 'What was your favorite feature?',
        placeholder: 'Tell us what stood out to you\u2026',
      },
      {
        id: 'most-improve',
        type: 'textarea',
        label: 'What would you most want to improve?',
        placeholder: 'What needs the most work\u2026',
      },
      {
        id: 'missing-features',
        type: 'textarea',
        label: 'Were there any features you expected but didn\'t find?',
        placeholder: 'e.g. "I expected to be able to..." or "In the old QD I could..."',
      },
      {
        id: 'other-comments',
        type: 'textarea',
        label: 'Any other comments or suggestions?',
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

  // ── Section 10: Thank You ──
  {
    id: 'thank-you',
    title: 'Thank You',
    description:
      'Your feedback has been recorded. Thank you for taking the time to evaluate the new Query Designer \u2014 your input is invaluable in helping us build a better product.',
    questions: [],
  },
]
