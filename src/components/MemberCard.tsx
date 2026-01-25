import React from 'react';
import { Card, Tag, Avatar, Tooltip, Flex } from 'antd';
import { UserOutlined, GithubOutlined, MailOutlined } from '@ant-design/icons';
import type { LabMember, SkillsData, MemberSkill } from '../types/types';
import { PROFICIENCY_COLORS, PROFICIENCY_LABELS } from '../types/types';
import {
  getSkillById,
  getMemberBlendedColor,
  getMemberCategoryWeights,
} from '../hooks/useSkillsData';

interface MemberCardProps {
  member: LabMember;
  data: SkillsData;
  onClick?: (member: LabMember) => void;
  onSkillClick?: (skillId: string) => void;
}

const SkillTag: React.FC<{
  skill: MemberSkill;
  data: SkillsData;
  onSkillClick?: (skillId: string) => void;
}> = ({ skill, data, onSkillClick }) => {
  const skillInfo = getSkillById(data.skills, skill.skillId);
  if (!skillInfo) return null;

  // Get colors from all categories this skill belongs to
  const categories = skillInfo.belongsTo
    .map((id) => data.categories.find((c) => c.id === id))
    .filter(Boolean);

  const isOverlap = categories.length > 1;
  return (
    <Tooltip
      title={
        <div>
          <div className='font-semibold'>{skillInfo.name}</div>
          <div className='text-xs opacity-80'>
            {PROFICIENCY_LABELS[skill.proficiency]}
          </div>
          {isOverlap && (
            <div className='text-xs mt-1'>
              Spans: {categories.map((c) => c?.name).join(', ')}
            </div>
          )}
        </div>
      }
    >
      <Tag
        className='category-badge m-1 cursor-pointer hover:brightness-110 transition-all'
        onClick={(e) => {
          e.stopPropagation();
          onSkillClick?.(skill.skillId);
        }}
        style={{
          background: `${PROFICIENCY_COLORS[skill.proficiency]}20`,
          borderColor: PROFICIENCY_COLORS[skill.proficiency],
          color: PROFICIENCY_COLORS[skill.proficiency],
        }}
      >
        <span
          className='proficiency-dot'
          style={{ backgroundColor: PROFICIENCY_COLORS[skill.proficiency] }}
        />
        {skillInfo.name}
        {isOverlap && <span className='ml-1 opacity-60'>⟷</span>}
      </Tag>
    </Tooltip>
  );
};

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  data,
  onClick,
  onSkillClick,
}) => {
  const categoryWeights = getMemberCategoryWeights(member, data);
  const blendedColor = getMemberBlendedColor(categoryWeights, data.categories);

  // Group skills by ALL categories they belong to
  const skillsByCategory: Record<string, MemberSkill[]> = {};
  for (const memberSkill of member.skills) {
    const skill = getSkillById(data.skills, memberSkill.skillId);
    if (!skill) continue;

    // Add skill to all categories it belongs to
    skill.belongsTo.forEach((catId) => {
      if (!skillsByCategory[catId]) {
        skillsByCategory[catId] = [];
      }
      skillsByCategory[catId].push(memberSkill);
    });
  }

  // Sort skills by proficiency (High to Low)
  const proficiencyWeight: Record<string, number> = {
    expert: 4,
    advanced: 3,
    intermediate: 2,
    beginner: 1,
  };

  Object.values(skillsByCategory).forEach((skills) => {
    skills.sort((a, b) => {
      const weightA = proficiencyWeight[a.proficiency] || 0;
      const weightB = proficiencyWeight[b.proficiency] || 0;
      return weightB - weightA;
    });
  });

  const [expanded, setExpanded] = React.useState(false);
  const INITIAL_VISIBLE_COUNT = 5;
  const hasHiddenSkills = Object.values(skillsByCategory).some(
    (skills) => skills.length > INITIAL_VISIBLE_COUNT,
  );

  return (
    <Card
      className='glass-card overflow-hidden'
      hoverable
      onClick={() => onClick?.(member)}
      styles={{
        body: { padding: '20px' },
      }}
    >
      <div className='flex items-start gap-4'>
        <Avatar
          size={64}
          icon={<UserOutlined />}
          src={member.avatar}
          className='flex-shrink-0'
          style={{
            background: blendedColor,
            border: '2px solid rgba(255, 255, 255, 0.2)',
          }}
        />
        <div className='flex-1 min-w-0'>
          <h3 className='text-lg font-semibold text-white mb-1 truncate'>
            {member.name}
          </h3>
          <p className='text-sm text-gray-400 mb-2'>{member.role}</p>
          <div className='flex gap-2 mb-3'>
            {member.email && (
              <Tooltip title={member.email}>
                <a
                  href={`mailto:${member.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className='text-gray-400 hover:text-white transition-colors'
                >
                  <MailOutlined />
                </a>
              </Tooltip>
            )}
            {member.github && (
              <Tooltip title={`@${member.github}`}>
                <a
                  href={`https://github.com/${member.github}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={(e) => e.stopPropagation()}
                  className='text-gray-400 hover:text-white transition-colors'
                >
                  <GithubOutlined />
                </a>
              </Tooltip>
            )}
          </div>

          {/* Category distribution bar */}
          <div className='flex h-2 rounded-full overflow-hidden mb-3'>
            {Object.entries(categoryWeights).map(([catId, weight]) => {
              const category = data.categories.find((c) => c.id === catId);
              const totalWeight = Object.values(categoryWeights).reduce(
                (a, b) => a + b,
                0,
              );
              return (
                <Tooltip
                  key={catId}
                  title={`${category?.name}: ${Math.round((weight / totalWeight) * 100)}%`}
                >
                  <div
                    style={{
                      backgroundColor: category?.color,
                      width: `${(weight / totalWeight) * 100}%`,
                    }}
                  />
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      <div className='mt-4'>
        {Object.entries(skillsByCategory).map(([categoryId, skills]) => {
          const category = data.categories.find((c) => c.id === categoryId);
          const visibleSkills = expanded
            ? skills
            : skills.slice(0, INITIAL_VISIBLE_COUNT);
          const hiddenCount = skills.length - visibleSkills.length;

          if (visibleSkills.length === 0) return null;

          return (
            <div key={categoryId} className='mb-2'>
              <span
                className='text-xs font-medium uppercase tracking-wider'
                style={{ color: category?.color || '#fff' }}
              >
                {category?.name || categoryId}
              </span>
              <Flex wrap={true} gap={5}>
                {visibleSkills.map((skill) => (
                  <SkillTag
                    key={skill.skillId}
                    skill={skill}
                    data={data}
                    onSkillClick={onSkillClick}
                  />
                ))}
                {!expanded && hiddenCount > 0 && (
                  <Tag
                    className='!mt-2 cursor-pointer hover:opacity-80 transition-opacity'
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px dashed rgba(255, 255, 255, 0.3)',
                      color: 'rgba(255, 255, 255, 0.6)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(true);
                    }}
                  >
                    +{hiddenCount} more
                  </Tag>
                )}
              </Flex>
            </div>
          );
        })}
        {expanded && hasHiddenSkills && (
          <div
            className='text-center mt-2 cursor-pointer text-xs text-gray-400 hover:text-white transition-colors'
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
          >
            Show Less
          </div>
        )}
      </div>
    </Card>
  );
};

export default MemberCard;
