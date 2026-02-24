import React from 'react';
import {HintSection} from '../types';
import {TheWorldSection} from './sections/the-world';
import {KeyConceptsSection} from './sections/key-concepts';
import {RealmsSection} from './sections/realms';
import {ResourcesSection} from './sections/resources';
import {TransfersSection} from './sections/transfers';
import {TheMapSection} from './sections/the-map';
import {BuildingsSection} from './sections/buildings';
import {TradingSection} from './sections/trading';
import {CombatSection} from './sections/combat';
import {WorldStructuresSection} from './sections/world-structures';
import {PointsSection} from './sections/points';
import {TribesSection} from './sections/tribes';

interface SectionContentProps {
  section: HintSection;
}

export function SectionContent({section}: SectionContentProps) {
  switch (section) {
    case HintSection.TheWorld:
      return <TheWorldSection />;
    case HintSection.KeyConcepts:
      return <KeyConceptsSection />;
    case HintSection.Realms:
      return <RealmsSection />;
    case HintSection.Resources:
      return <ResourcesSection />;
    case HintSection.Transfers:
      return <TransfersSection />;
    case HintSection.TheMap:
      return <TheMapSection />;
    case HintSection.Buildings:
      return <BuildingsSection />;
    case HintSection.Trading:
      return <TradingSection />;
    case HintSection.Combat:
      return <CombatSection />;
    case HintSection.WorldStructures:
      return <WorldStructuresSection />;
    case HintSection.Points:
      return <PointsSection />;
    case HintSection.Tribes:
      return <TribesSection />;
    default:
      return null;
  }
}
