import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { Avatar, Tooltip } from 'antd';
import { UserOutlined, TeamOutlined, StarOutlined } from '@ant-design/icons';
import type { SkillGap, SkillCategory, ProficiencyLevel } from '../types/types';
import { PROFICIENCY_COLORS, PROFICIENCY_LABELS } from '../types/types';

interface GapDistributionChartProps {
  gaps: SkillGap[];
  categories: SkillCategory[];
  members: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    skills: { skillId: string; proficiency: ProficiencyLevel }[];
  }[];
}

interface CategoryExpertise {
  category: SkillCategory;
  expertCount: number;
  advancedCount: number;
  intermediateCount: number;
  beginnerCount: number;
}

interface SkillData {
  id: string;
  name: string;
  expert: number;
  advanced: number;
  intermediate: number;
  beginner: number;
  total: number;
}

interface MemberDetail {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  proficiency: ProficiencyLevel;
}

const EXPERTISE_LEVELS: ProficiencyLevel[] = [
  'expert',
  'advanced',
  'intermediate',
  'beginner',
];
const STACKING_ORDER: ProficiencyLevel[] = [
  'expert',
  'advanced',
  'intermediate',
  'beginner',
];

const GapDistributionChart: React.FC<GapDistributionChartProps> = ({
  gaps,
  categories,
  members,
}) => {
  const navigate = useNavigate();
  const radarRef = useRef<SVGSVGElement>(null);
  const barRef = useRef<SVGSVGElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0]?.id || '',
  );
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<ProficiencyLevel | null>(
    null,
  );

  // Calculate expertise distribution per category
  const categoryData = useMemo<CategoryExpertise[]>(() => {
    return categories
      .map((cat) => {
        const catGaps = gaps.filter((g) =>
          g.categories.some((c) => c.id === cat.id),
        );
        let expert = 0,
          advanced = 0,
          intermediate = 0,
          beginner = 0;
        catGaps.forEach((gap) => {
          members.forEach((m) => {
            const ms = m.skills.find((s) => s.skillId === gap.skill.id);
            if (ms) {
              if (ms.proficiency === 'expert') expert++;
              else if (ms.proficiency === 'advanced') advanced++;
              else if (ms.proficiency === 'intermediate') intermediate++;
              else if (ms.proficiency === 'beginner') beginner++;
            }
          });
        });
        return {
          category: cat,
          expertCount: expert,
          advancedCount: advanced,
          intermediateCount: intermediate,
          beginnerCount: beginner,
        };
      })
      .filter(
        (c) =>
          c.expertCount +
            c.advancedCount +
            c.intermediateCount +
            c.beginnerCount >
          0,
      );
  }, [gaps, categories, members]);

  // Get skills for selected category
  const skillsData = useMemo<SkillData[]>(() => {
    if (!selectedCategory) return [];
    const catGaps = gaps.filter((g) =>
      g.categories.some((c) => c.id === selectedCategory),
    );
    return catGaps
      .map((gap) => {
        let expert = 0,
          advanced = 0,
          intermediate = 0,
          beginner = 0;
        members.forEach((m) => {
          const ms = m.skills.find((s) => s.skillId === gap.skill.id);
          if (ms) {
            if (ms.proficiency === 'expert') expert++;
            else if (ms.proficiency === 'advanced') advanced++;
            else if (ms.proficiency === 'intermediate') intermediate++;
            else if (ms.proficiency === 'beginner') beginner++;
          }
        });
        return {
          id: gap.skill.id,
          name: gap.skill.name,
          expert,
          advanced,
          intermediate,
          beginner,
          total: expert + advanced + intermediate + beginner,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [gaps, members, selectedCategory]);

  // Members grouped by proficiency
  const membersByProficiency = useMemo<
    Record<ProficiencyLevel, MemberDetail[]>
  >(() => {
    const result: Record<ProficiencyLevel, MemberDetail[]> = {
      expert: [],
      advanced: [],
      intermediate: [],
      beginner: [],
    };
    if (!selectedSkill) return result;
    members.forEach((m) => {
      const ms = m.skills.find((s) => s.skillId === selectedSkill);
      if (ms)
        result[ms.proficiency].push({
          id: m.id,
          name: m.name,
          avatar: m.avatar,
          role: m.role,
          proficiency: ms.proficiency,
        });
    });
    return result;
  }, [selectedSkill, members]);

  const selectedSkillInfo = useMemo(
    () =>
      selectedSkill
        ? skillsData.find((s) => s.id === selectedSkill) || null
        : null,
    [selectedSkill, skillsData],
  );
  const totalSelectedMembers = useMemo(
    () =>
      Object.values(membersByProficiency).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ),
    [membersByProficiency],
  );
  const selectedCategoryInfo = categoryData.find(
    (c) => c.category.id === selectedCategory,
  );

  // Draw Radar Chart
  useEffect(() => {
    if (!radarRef.current || categoryData.length === 0) return;
    const svg = d3.select(radarRef.current);
    const width = 400;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 85;

    svg.selectAll('*').remove();
    svg.attr('viewBox', [0, 0, width, height]);

    const g = svg
      .append('g')
      .attr('transform', `translate(${centerX},${centerY})`);

    // Calculate max count for scaling
    const maxCount = Math.max(
      ...categoryData.flatMap((d) => [
        d.expertCount,
        d.advancedCount,
        d.intermediateCount,
        d.beginnerCount,
      ]),
      1,
    );

    // Create radial scale
    const rScale = d3.scaleLinear().domain([0, maxCount]).range([0, radius]);
    const ticks = rScale.ticks(4).slice(1); // Generate nice integer ticks, exclude 0

    // Draw Grid Circles and Labels
    ticks.forEach((tick) => {
      const r = rScale(tick);
      g.append('circle')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.08)');

      g.append('text')
        .attr('x', 0)
        .attr('y', -r)
        .attr('dy', -2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.3)')
        .attr('font-size', '9px')
        .text(tick);
    });

    const angleSlice = (Math.PI * 2) / categoryData.length;

    categoryData.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const isSelected = selectedCategory === d.category.id;

      // Draw Axis Line (Highlighted if selected)
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr(
          'stroke',
          isSelected ? d.category.color : 'rgba(255,255,255,0.12)',
        )
        .attr('stroke-width', isSelected ? 2 : 1)
        .attr('stroke-opacity', isSelected ? 0.8 : 1)
        .style('transition', 'all 0.3s ease'); // Smooth transition

      const labelR = radius + 45;
      const lx = Math.cos(angle) * labelR;
      const ly = Math.sin(angle) * labelR;

      const labelGroup = g
        .append('g')
        .style('cursor', 'pointer')
        .on('click', () => {
          setSelectedCategory(d.category.id);
          setSelectedSkill(null);
        });

      // Calculate approximate box width based on text length
      const boxWidth = Math.max(90, d.category.name.length * 9);
      const boxHeight = 26;

      // Background Box (Visible when selected)
      labelGroup
        .append('rect')
        .attr('x', lx - boxWidth / 2)
        .attr('y', ly - boxHeight / 2)
        .attr('width', boxWidth)
        .attr('height', boxHeight)
        .attr('rx', 13) // Pill shape
        .attr('ry', 13)
        .attr('fill', isSelected ? d.category.color : 'transparent')
        .attr('fill-opacity', isSelected ? 0.15 : 0)
        .attr('stroke', isSelected ? d.category.color : 'transparent')
        .attr('stroke-width', 1)
        .style('transition', 'all 0.3s ease');

      labelGroup
        .append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', isSelected ? d.category.color : 'rgba(255,255,255,0.7)')
        .attr('font-size', isSelected ? '12px' : '11px')
        .attr('font-weight', isSelected ? '700' : '400')
        .style('transition', 'all 0.2s ease')
        .text(d.category.name)
        .on('mouseenter', function () {
          d3.select(this)
            .attr('fill', d.category.color)
            .attr('font-weight', '700')
            .style('filter', 'drop-shadow(0 0 4px rgba(0,0,0,0.5))');

          // Also highlight the box slightly on hover if not selected
          if (!isSelected) {
            d3.select(this.previousSibling as Element)
              .attr('fill', 'rgba(255,255,255,0.05)')
              .attr('fill-opacity', 1);
          }
        })
        .on('mouseleave', function () {
          d3.select(this)
            .attr(
              'fill',
              isSelected ? d.category.color : 'rgba(255,255,255,0.7)',
            )
            .attr('font-weight', isSelected ? '700' : '400')
            .style('filter', 'none');

          if (!isSelected) {
            d3.select(this.previousSibling as Element)
              .attr('fill', 'transparent')
              .attr('fill-opacity', 0);
          }
        });
    });

    const radarLine = d3
      .lineRadial<number>()
      .radius((d) => rScale(d))
      .angle((_, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    [...EXPERTISE_LEVELS].reverse().forEach((level) => {
      const levelKey = `${level}Count` as keyof CategoryExpertise;
      const values = categoryData.map((d) => d[levelKey] as number);
      const isHovered = hoveredLevel === level;
      const opacity = hoveredLevel === null ? 0.6 : isHovered ? 1 : 0.15;
      const color = PROFICIENCY_COLORS[level];

      // Draw the path
      g.append('path')
        .datum(values)
        .attr('d', radarLine)
        .attr('fill', color)
        .attr('fill-opacity', opacity * 0.25)
        .attr('stroke', color)
        .attr('stroke-width', isHovered ? 2.5 : 1.5)
        .attr('stroke-opacity', opacity)
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHoveredLevel(level))
        .on('mouseleave', () => setHoveredLevel(null));

      // Draw invisible circles for tooltips at each vertex
      categoryData.forEach((d, i) => {
        const val = d[levelKey] as number;
        const angle = angleSlice * i - Math.PI / 2; // -90 deg offset
        // rScale is the radial scale we defined earlier
        const r = rScale(val);
        const cx = Math.cos(angle) * r;
        const cy = Math.sin(angle) * r;

        const circle = g
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 4)
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0) // Hidden by default
          .style('cursor', 'pointer');

        // Show on hover of the circle itself OR if the level is hovered
        if (isHovered) {
          circle.attr('opacity', 1);
        }

        circle
          .on('mouseenter', function () {
            d3.select(this).attr('opacity', 1).attr('r', 6);
            setHoveredLevel(level);
          })
          .on('mouseleave', function () {
            d3.select(this)
              .attr('opacity', hoveredLevel === level ? 1 : 0)
              .attr('r', 4);
            setHoveredLevel(null);
          });

        // Add Tooltip
        circle
          .append('title')
          .text(
            `${d.category.name}\n${PROFICIENCY_LABELS[level]}: ${val} people`,
          );
      });
    });
  }, [categoryData, selectedCategory, hoveredLevel]);

  // Draw Stacked Bar Chart with hover effect
  useEffect(() => {
    if (!barRef.current || skillsData.length === 0) return;
    const svg = d3.select(barRef.current);
    const container = barRef.current.parentElement;
    const containerWidth = container?.clientWidth || 600;

    const margin = { top: 20, right: 20, bottom: 110, left: 45 };
    const width = Math.max(
      containerWidth,
      skillsData.length * 45 + margin.left + margin.right,
    );
    const height = 400; // Same as radar
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand()
      .domain(skillsData.map((d) => d.id))
      .range([0, innerWidth])
      .padding(0.2);
    const maxTotal = d3.max(skillsData, (d) => d.total) || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxTotal])
      .nice()
      .range([innerHeight, 0]);

    const stackedData = skillsData.map((skill) => {
      let cum = 0;
      const bars = STACKING_ORDER.map((level) => {
        const val = skill[level];
        const bar = { level, y0: cum, y1: cum + val, value: val };
        cum += val;
        return bar;
      }).filter((b) => b.value > 0);
      return { skill, bars };
    });

    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => ''),
      )
      .selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.05)');
    g.select('.domain').remove();

    // Draw bars with HOVER EFFECT using D3 direct manipulation
    const allRects: d3.Selection<SVGRectElement, unknown, null, undefined>[] =
      [];

    stackedData.forEach(({ skill, bars }) => {
      const isSelected = selectedSkill === skill.id;
      // If a skill is selected, others should be dimmed
      const baseOpacity = selectedSkill ? (isSelected ? 1 : 0.3) : 1;

      bars.forEach((bar) => {
        const rect = g
          .append('rect')
          .attr('x', xScale(skill.id)!)
          .attr('y', yScale(bar.y1))
          .attr('width', xScale.bandwidth())
          .attr('height', Math.max(0, yScale(bar.y0) - yScale(bar.y1)))
          .attr('fill', PROFICIENCY_COLORS[bar.level])
          .attr('opacity', baseOpacity)
          .style('cursor', 'pointer')
          .style('transition', 'opacity 0.3s ease')
          .attr('data-skill-id', skill.id)
          .attr('data-level', bar.level);

        allRects.push(rect);

        rect
          .on('mouseenter', function () {
            // Dim all OTHER bars
            allRects.forEach((r) => {
              const rSkillId = r.attr('data-skill-id');
              const rLevel = r.attr('data-level');
              if (rSkillId !== skill.id || rLevel !== bar.level) {
                r.attr('opacity', 0.1);
              }
            });
            // Ensure this bar is fully visible
            d3.select(this).attr('opacity', 1);
          })
          .on('mouseleave', function () {
            // Restore base opacity state depending on selection
            allRects.forEach((r) => {
              const rSkillId = r.attr('data-skill-id');
              const isActive = selectedSkill
                ? rSkillId === selectedSkill
                : true;
              r.attr('opacity', isActive ? 1 : 0.3);
            });
          })
          .on('click', function () {
            setSelectedSkill(skill.id);
          });

        // Tooltip
        rect
          .append('title')
          .text(
            `${skill.name}\n${PROFICIENCY_LABELS[bar.level]}: ${bar.value} people`,
          );
      });
    });

    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0));
    xAxis.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)');
    xAxis
      .selectAll('text')
      .attr('fill', (d) =>
        selectedSkill === d ? '#fff' : 'rgba(255,255,255,0.7)',
      )
      .attr('font-size', '10px')
      .attr('font-weight', (d) => (selectedSkill === d ? '700' : '400'))
      .attr('transform', 'rotate(-50)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.3em')
      .style('cursor', 'pointer')
      .style('transition', 'fill 0.2s ease')
      .text((d) => skillsData.find((s) => s.id === d)?.name || '')
      .on('mouseenter', function (_, d) {
        const skillId = d as string;
        // Highlight this text
        d3.select(this).attr('fill', '#fff').attr('font-weight', '700');

        // Update bars to highlight this skill
        allRects.forEach((r) => {
          const rSkillId = r.attr('data-skill-id');
          if (rSkillId === skillId) {
            r.attr('opacity', 1);
          } else {
            r.attr('opacity', 0.1);
          }
        });
      })
      .on('mouseleave', function (_, d) {
        const skillId = d as string;
        // Reset text style based on selection
        const isSelected = selectedSkill === skillId;
        d3.select(this)
          .attr('fill', isSelected ? '#fff' : 'rgba(255,255,255,0.7)')
          .attr('font-weight', isSelected ? '700' : '400');

        // Restore bar opacities based on selection state
        allRects.forEach((r) => {
          const rSkillId = r.attr('data-skill-id');
          const isActive = selectedSkill ? rSkillId === selectedSkill : true;
          r.attr('opacity', isActive ? 1 : 0.3);
        });
      })
      .on('click', (_, d) => setSelectedSkill(d as string));

    const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(5));
    yAxis.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)');
    yAxis
      .selectAll('text')
      .attr('fill', 'rgba(255,255,255,0.6)')
      .attr('font-size', '10px');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -32)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.5)')
      .attr('font-size', '11px')
      .text('Team Members');
  }, [skillsData, selectedSkill]);

  return (
    <div className='space-y-4'>
      {/* Top: Radar + Bar - SAME HEIGHT */}
      <div className='flex flex-col xl:flex-row gap-4 items-stretch'>
        {/* LEFT: Radar */}
        <div className='flex-shrink-0 xl:w-[400px]'>
          <div className='h-full p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col'>
            <h3 className='text-white font-semibold text-sm mb-2 text-center'>
              Expertise Distribution
            </h3>
            <div className='flex-1 flex items-center justify-center'>
              <svg ref={radarRef} className='w-[400px] h-[400px]' />
            </div>
            <div className='grid grid-cols-2 gap-2 mt-2'>
              {EXPERTISE_LEVELS.map((level) => (
                <div
                  key={level}
                  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-all ${hoveredLevel === level ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  onMouseEnter={() => setHoveredLevel(level)}
                  onMouseLeave={() => setHoveredLevel(null)}
                >
                  <div
                    className='w-3 h-3 rounded-full'
                    style={{ backgroundColor: PROFICIENCY_COLORS[level] }}
                  />
                  <span className='text-gray-300 text-xs'>
                    {PROFICIENCY_LABELS[level]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Bar */}
        <div className='flex-1 min-w-0'>
          <div className='h-full p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col'>
            <div className='flex items-center justify-between mb-2'>
              <h3 className='text-white font-semibold text-sm flex items-center gap-2'>
                <span
                  className='w-3 h-3 rounded-full'
                  style={{
                    backgroundColor: selectedCategoryInfo?.category.color,
                  }}
                />
                {selectedCategoryInfo?.category.name || 'Select a category'}
              </h3>
              <span className='text-gray-500 text-xs'>
                {skillsData.length} skills
              </span>
            </div>
            <div className='flex-1 overflow-x-auto'>
              <svg ref={barRef} />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM: Detail - ALIGNED ROWS */}
      {selectedSkillInfo && (
        <div className='p-4 rounded-xl bg-white/5 border border-white/10 animate-fade-in-up'>
          <div className='flex items-start justify-between mb-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 rounded-lg bg-indigo-500/20'>
                <StarOutlined className='text-indigo-400 text-lg' />
              </div>
              <div>
                <h3 className='text-white font-bold text-lg'>
                  {selectedSkillInfo.name}
                </h3>
                <span className='text-gray-400 text-sm flex items-center gap-1'>
                  <TeamOutlined /> {totalSelectedMembers} members
                </span>
              </div>
            </div>
            <button
              className='text-gray-500 hover:text-white text-xl px-2'
              onClick={() => setSelectedSkill(null)}
            >
              ×
            </button>
          </div>

          {totalSelectedMembers === 0 ? (
            <div className='p-4 text-center text-red-400 bg-red-500/10 rounded-lg border border-red-500/20'>
              <p className='font-semibold'>
                ⚠️ No team members have this skill
              </p>
            </div>
          ) : (
            // ALIGNED TABLE LAYOUT - bars and members in same row
            <div className='space-y-1'>
              {EXPERTISE_LEVELS.map((level) => {
                const levelMembers = membersByProficiency[level];
                const count = levelMembers.length;
                const maxCount = Math.max(
                  ...EXPERTISE_LEVELS.map(
                    (l) => membersByProficiency[l].length,
                  ),
                  1,
                );

                return (
                  <div
                    key={level}
                    className='flex items-center gap-3 min-h-[40px]'
                  >
                    {/* Label */}
                    <span className='text-gray-400 text-xs w-20 text-right flex-shrink-0'>
                      {PROFICIENCY_LABELS[level]}
                    </span>

                    {/* Bar */}
                    <div className='w-16 flex-shrink-0'>
                      <div className='h-5 bg-white/5 rounded overflow-hidden'>
                        <div
                          className='h-full rounded'
                          style={{
                            width: `${(count / maxCount) * 100}%`,
                            backgroundColor: PROFICIENCY_COLORS[level],
                          }}
                        />
                      </div>
                    </div>

                    {/* Count */}
                    <span className='text-white text-xs w-6 flex-shrink-0'>
                      {count}
                    </span>

                    {/* Members - aligned with bar row */}
                    <div className='flex-1 flex flex-wrap gap-1 items-center'>
                      {levelMembers.map((member) => (
                        <Tooltip
                          key={member.id}
                          title={`${member.name} - ${member.role}`}
                        >
                          <div
                            className='flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:brightness-110 cursor-pointer'
                            style={{
                              backgroundColor: `${PROFICIENCY_COLORS[level]}25`,
                            }}
                            onClick={() =>
                              navigate(`/overview?member=${member.name}`)
                            }
                          >
                            <Avatar
                              size={18}
                              icon={<UserOutlined />}
                              src={member.avatar}
                              style={{
                                border: `1.5px solid ${PROFICIENCY_COLORS[level]}`,
                              }}
                            />
                            <span className='text-white text-xs'>
                              {member.name}
                            </span>
                          </div>
                        </Tooltip>
                      ))}
                      {count === 0 && (
                        <span className='text-gray-600 text-xs italic'>
                          None
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GapDistributionChart;
