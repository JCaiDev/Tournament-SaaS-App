import { LobbyFormat } from '../../models/lobby';

// UI copy for each lobby format, shared by the chooser cards and the create form.
export interface LobbyFormatOption {
  format: LobbyFormat;
  slug: 'pickup' | 'tournament'; // URL segment and view-transition name suffix
  cardTitle: string;
  cardDescription: string;
  formTitle: string;
  formSub: string;
  nameLabel: string;
  priceLabel: string;
}

export const LOBBY_FORMATS: Record<LobbyFormat, LobbyFormatOption> = {
  PICKUP: {
    format: 'PICKUP',
    slug: 'pickup',
    cardTitle: 'Host a pickup game',
    cardDescription: 'One game, one time. Players join or apply, and you manage the roster.',
    formTitle: 'Host a pickup game',
    formSub: 'Create a game for players to find.',
    nameLabel: 'Game name',
    priceLabel: 'Price per player (CAD)',
  },
  TOURNAMENT: {
    format: 'TOURNAMENT',
    slug: 'tournament',
    cardTitle: 'Organize a tournament',
    cardDescription: 'Teams, pools, a schedule, and live standings for the day.',
    formTitle: 'Organize a tournament',
    formSub: "Set the basics now. You'll add teams after it's created.",
    nameLabel: 'Tournament name',
    priceLabel: 'Entry fee (CAD)',
  },
};
