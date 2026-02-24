import {useState} from 'react';
import type {Guild, GuildMember} from '../types';

const MOCK_MEMBERS: GuildMember[] = [
  {id: '1', username: 'DragonLord', role: 'leader', isOnline: true, points: 15000},
  {id: '2', username: 'ShadowBlade', role: 'officer', isOnline: true, points: 12000},
  {id: '3', username: 'IronFist', role: 'officer', isOnline: false, points: 10500},
  {id: '4', username: 'StormBreaker', role: 'member', isOnline: true, points: 8200},
  {id: '5', username: 'MoonWalker', role: 'member', isOnline: false, points: 7100},
  {id: '6', username: 'FireStarter', role: 'member', isOnline: true, points: 6800},
  {id: '7', username: 'NightHawk', role: 'member', isOnline: false, points: 5500},
  {id: '8', username: 'SilverArrow', role: 'member', isOnline: false, points: 4200},
];

export function useGuildDetail(guildId: string) {
  const [isLoading] = useState(false);

  // TODO: Replace with real data from Torii
  const guild: Guild = {
    id: guildId,
    name: 'Order of the Flame',
    description: 'Warriors united by fire and honor. Founded in Season 1.',
    memberCount: MOCK_MEMBERS.length,
    maxMembers: 30,
    rank: 1,
    totalPoints: 125000,
    members: MOCK_MEMBERS,
  };

  const onlineMembers = guild.members.filter(m => m.isOnline);
  const offlineMembers = guild.members.filter(m => !m.isOnline);

  return {guild, onlineMembers, offlineMembers, isLoading};
}
