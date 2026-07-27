import type { SurveyQuestionType } from '@/types/models';

export interface TemplateQuestion {
  text: string;
  type: SurveyQuestionType;
  options?: string[];
  required?: boolean;
  visibleToCoaches?: boolean;
  maxSelections?: number;
}

export interface SurveyTemplate {
  key: string;
  name: string;
  title: string;
  description: string;
  questions: TemplateQuestion[];
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    key: 'parent-season-planning',
    name: 'Parent Season Planning',
    title: 'Parent Survey – 2026/2027 Season Planning',
    description:
      "As we begin planning for next season, I'd like your input to better understand your family's goals and priorities. Our goal is to build a program that balances player development, competition, and family expectations. Please answer honestly. There are no right or wrong answers.",
    questions: [
      { text: 'Player Name (optional)', type: 'text', required: false },
      {
        text: 'Is your daughter planning to return next season?',
        type: 'multiple_choice',
        required: true,
        options: ['Yes', 'No', 'Unsure'],
      },
      {
        text: "What are your top priorities for your daughter's softball experience? (Select up to 3)",
        type: 'checkbox',
        visibleToCoaches: true,
        maxSelections: 3,
        options: [
          'Skill development',
          'Pitching/catching development',
          'Playing time',
          'Team competitiveness / winning',
          'Exposure to college recruiters',
          'Strong team culture / friendships',
          'Mental toughness / confidence building',
          'Preparation for high school softball',
          'Having fun / enjoying the experience',
        ],
      },
      {
        text: 'Which tournament model do you prefer?',
        type: 'multiple_choice',
        options: [
          'Mostly local / Northern Michigan tournaments (similar to current model)',
          'Mostly regional travel tournaments (Grand Rapids, Detroit, Chicago, etc.)',
          'Balanced mix of local + regional',
          'No strong preference',
        ],
      },
      {
        text: 'How interested are you in attending higher-level exposure/showcase tournaments? (1 = Not interested, 5 = Very interested)',
        type: 'rating',
      },
      {
        text: 'How much travel are you realistically willing to commit to?',
        type: 'multiple_choice',
        options: ['1–2 overnight weekends', '3–5 overnight weekends', '6+ overnight weekends'],
      },
      {
        text: 'What budget range feels reasonable for next season (excluding personal travel/hotel costs)?',
        type: 'multiple_choice',
        options: ['Under $1,200', '$1,200–$1,600', '$1,600–$2,000', '$2,000+'],
      },
      {
        text: 'How important is playing against stronger competition, even if it means more losses? (1 = Not important, 5 = Very important)',
        type: 'rating',
      },
      {
        text: 'What level of commitment are you looking for next season?',
        type: 'multiple_choice',
        options: [
          'Similar to current expectations',
          'More intense (more practices, training, travel)',
          'Less intense (more flexibility)',
        ],
      },
      {
        text: 'Which optional opportunities would interest your family? (Check all that apply)',
        type: 'checkbox',
        visibleToCoaches: true,
        options: [
          'Winter strength/speed training',
          'Team/Individual hitting sessions',
          'Extra pitching/catching sessions',
          'College recruiting education',
          'Mental performance training',
          'Team bonding/social events',
          'Fundraising opportunities to offset costs',
        ],
      },
      { text: 'What do you think our team does well right now?', type: 'text', visibleToCoaches: true },
      { text: 'What would you like to see change or improve next season?', type: 'text', visibleToCoaches: true },
      {
        text: 'Rank these from most important to least important',
        type: 'ranking',
        visibleToCoaches: true,
        options: ['Development', 'Winning', 'Exposure', 'Team culture'],
      },
    ],
  },
  {
    key: 'post-tournament-feedback',
    name: 'Post-Tournament Feedback',
    title: 'Tournament Weekend Feedback',
    description:
      'Quick pulse check after this weekend — 2 minutes, anonymous to coaches. Your feedback helps us plan better tournament weekends.',
    questions: [
      {
        text: 'Overall, how was the tournament weekend for your family? (1 = rough, 5 = great)',
        type: 'rating',
        required: true,
        visibleToCoaches: true,
      },
      {
        text: 'Was the travel distance manageable?',
        type: 'yes_no',
        required: true,
        visibleToCoaches: true,
      },
      {
        text: 'Did your daughter get the playing time you expected?',
        type: 'yes_no',
      },
      {
        text: 'What worked well this weekend? (Select up to 3)',
        type: 'checkbox',
        maxSelections: 3,
        visibleToCoaches: true,
        options: [
          'Game schedule / pacing',
          'Communication before & during',
          'Team energy and effort',
          'Coaching decisions',
          'Facilities',
          'Team bonding between games',
        ],
      },
      { text: 'Anything we should do differently next tournament?', type: 'text', visibleToCoaches: true },
    ],
  },
];
