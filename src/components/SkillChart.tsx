import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

import skillsData from '../../public/data/skillsData.json';
import * as venn from '../utils/d3-venn';
import type { Area } from '../utils/d3-venn';
import type { SkillsData } from '../types/types';

// --- Interfaces ---

interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  belongsTo: string[];
}

interface MemberSkill {
  skillId: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

interface Member {
  id: string;
  name: string;
  role: string;
  email: string;
  github?: string;
  skills: MemberSkill[];
}

// --- Join Member Info with Skills for Visualization ---
interface PersonNode extends d3.SimulationNodeDatum {
  id: string; // Member ID
  name: string;
  role: string;
  proficiency: string;
  r: number; // radius for visualization
}

interface SkillNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  categories: string[];
  people: PersonNode[];
  r: number; // Radius of the skill circle
  groupId: string; // ID of the intersection group this skill belongs to
}

interface GroupNode extends d3.SimulationNodeDatum {
  id: string; // "A" or "A,B" etc.
  x: number;
  y: number;
  r: number; // Target radius based on content
  targetX: number; // Venn center X
  targetY: number; // Venn center Y
}

interface SkillChartProps {
  data?: SkillsData;
  onMemberClick?: (member: Member) => void;
  width?: number;
  height?: number;
}

const SkillChart: React.FC<SkillChartProps> = ({
  width: propWidth,
  height: propHeight,
  onMemberClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({
    width: propWidth || 800,
    height: propHeight || 600,
  });

  // Update dimensions on mount/resize if not fixed props
  useEffect(() => {
    if (propWidth && propHeight) {
      setDimensions({ width: propWidth, height: propHeight });
      return;
    }

    const updateDims = () => {
      if (svgRef.current && svgRef.current.parentElement) {
        const { width, height } =
          svgRef.current.parentElement.getBoundingClientRect();
        // Ensure reasonable minimums
        setDimensions({
          width: propWidth || Math.max(width, 600),
          height: propHeight || Math.max(height, 500),
        });
      }
    };
    window.addEventListener('resize', updateDims);
    updateDims();
    return () => window.removeEventListener('resize', updateDims);
  }, [propWidth, propHeight]);

  // --- Data Preparation ---
  const { nodes, groups, vennCircles } = useMemo(() => {
    const width = dimensions.width;
    const height = dimensions.height;

    // 1. Prepare Venn Areas
    // We need to calculate the "size" of each set A, B, C, D and their intersections AB, AC, etc.
    // Size = count of skills in that set/intersection (or weighted).

    const skillListRaw = skillsData.skills as Skill[];
    const categoryList = skillsData.categories as Category[];
    const memberList = skillsData.members as Member[];

    // Filter out skills that have no people
    const skillList = skillListRaw.filter((skill) =>
      memberList.some((m) => m.skills.some((s) => s.skillId === skill.id)),
    );

    // Count skills per intersection
    const intersectionCounts: Record<string, number> = {};

    skillList.forEach((skill) => {
      // Sort to ensure "A,B" is same as "B,A"
      const setKey = skill.belongsTo.slice().sort().join(',');
      intersectionCounts[setKey] = (intersectionCounts[setKey] || 0) + 1;
    });

    // Generate Area[] for d3-venn
    const areas: Area[] = [];
    const setSizes: Record<string, number> = {};

    // Helper to generate all subsets
    const getSubsets = (arr: string[]) => {
      return arr.reduce(
        (subsets, value) =>
          subsets.concat(subsets.map((set) => [value, ...set])),
        [[]] as string[][],
      );
    };

    skillList.forEach((skill) => {
      const subsets = getSubsets(skill.belongsTo);
      subsets.forEach((subset) => {
        if (subset.length === 0) return;
        const key = subset.sort().join(',');
        setSizes[key] = (setSizes[key] || 0) + 1;
      });
    });

    for (const [key, size] of Object.entries(setSizes)) {
      // Using a slightly more aggressive scaling for visualization
      areas.push({ sets: key.split(','), size: size * 15 });
    }

    // Ensure all base categories exist even if empty (though unlikely)
    categoryList.forEach((cat) => {
      if (!areas.some((a) => a.sets.length === 1 && a.sets[0] === cat.id)) {
        areas.push({ sets: [cat.id], size: 5 }); // Minimum size
      }
    });

    // 2. Compute Layout
    const solution = venn.venn(areas);
    const scaledSolution = venn.scaleSolution(solution, width, height, 10); // Reduced padding to make diagram larger
    const centres = venn.computeTextCentres(scaledSolution, areas);

    // 3. Process Skills & Groups
    const groupNodesMap = new Map<string, GroupNode>();

    const skillNodes: SkillNode[] = skillList.map((skill) => {
      // Find people with this skill
      const peopleInSkill: PersonNode[] = [];
      memberList.forEach((member) => {
        const memberSkill = member.skills.find((s) => s.skillId === skill.id);
        if (memberSkill) {
          peopleInSkill.push({
            id: member.id,
            name: member.name,
            role: member.role,
            proficiency: memberSkill.proficiency,
            r: 4, // Fixed radius for person dot
          });
        }
      });

      // Calculate Skill Radius
      const minRadius = 18; // Smaller base size
      const calculatedRadius = Math.max(
        minRadius,
        Math.sqrt(peopleInSkill.length) * 8 + 5,
      );

      // Pack people inside the skill radius
      if (peopleInSkill.length > 0) {
        const root = d3
          .pack()
          .size([calculatedRadius * 2, calculatedRadius * 2])
          .padding(2)(
          // Reduced padding
          (
            d3.hierarchy({
              children: peopleInSkill,
            }) as d3.HierarchyNode<PersonNode>
          ).sum(() => 1),
        );

        const leaves = root.leaves();
        leaves.forEach((leaf, i) => {
          if (peopleInSkill[i]) {
            peopleInSkill[i].x = leaf.x - calculatedRadius;
            peopleInSkill[i].y = leaf.y - calculatedRadius;
          }
        });
      }

      // Identify Group (Set Intersection)
      const setKey = skill.belongsTo.slice().sort().join(',');

      // Initialize Group Node if not exists
      if (!groupNodesMap.has(setKey)) {
        let center = centres[setKey];
        // If center missing (rare), fallback to average of raw categories
        if (!center) {
          let tx = 0,
            ty = 0,
            count = 0;
          skill.belongsTo.forEach((catId) => {
            if (scaledSolution[catId]) {
              tx += scaledSolution[catId].x;
              ty += scaledSolution[catId].y;
              count++;
            }
          });
          center =
            count > 0
              ? { x: tx / count, y: ty / count }
              : { x: width / 2, y: height / 2 };
        }

        groupNodesMap.set(setKey, {
          id: setKey,
          x: center.x,
          y: center.y,
          targetX: center.x,
          targetY: center.y,
          r: 0, // Will sum up skill areas
        });
      }

      // Add area to group radius calculation (approximate)
      const group = groupNodesMap.get(setKey)!;
      // Area = pi * r^2. We sum areas.
      group.r = Math.sqrt(
        group.r * group.r + calculatedRadius * calculatedRadius,
      );

      return {
        id: skill.id,
        name: skill.name,
        categories: skill.belongsTo,
        people: peopleInSkill,
        r: calculatedRadius,
        groupId: setKey,
        x: group.x + (Math.random() - 0.5) * 50,
        y: group.y + (Math.random() - 0.5) * 50,
      };
    });

    // Finalize Group Radii (add padding)
    const groupNodes = Array.from(groupNodesMap.values()).map((g) => ({
      ...g,
      r: g.r + 20, // Add padding for "Virtual Circle"
    }));

    return {
      nodes: skillNodes,
      groups: groupNodes,
      vennCircles: scaledSolution,
    };
  }, [dimensions]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', [0, 0, dimensions.width, dimensions.height])
      .style('font-family', "'Inter', sans-serif"); // Use project font

    svg.selectAll('*').remove(); // Clear previous

    // --- Zoom Behavior ---
    const container = svg.append('g').attr('class', 'chart-container');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // --- Draw Category Foci Backgrounds (Venn Circles) ---
    // Using simple circles for background regions
    const catGroup = container.append('g').attr('class', 'categories');
    const categoryList = skillsData.categories;
    const categoryMap = new Map(categoryList.map((c) => [c.id, c]));

    Object.entries(vennCircles).forEach(([id, circle]) => {
      const cat = categoryMap.get(id);
      if (!cat) return;

      // Gradient for glass look
      const gradientId = `grad-${id}`;
      const gradient = svg
        .append('defs') // Defs can stay on SVG or container, consistent to keep on SVG or container but widely scoped. SVG is safer for defs to not transform? Actually defs don't render so transform doesn't matter, but standard is SVG. We need access to svg for defs or just append to container. Let's use `svg` for defs to be clean.
        .append('radialGradient')
        .attr('id', gradientId)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');

      gradient
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', cat.color)
        .attr('stop-opacity', 0.1);

      gradient
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', cat.color)
        .attr('stop-opacity', 0.02);

      catGroup
        .append('circle')
        .attr('cx', circle.x)
        .attr('cy', circle.y)
        .attr('r', circle.radius)
        .attr('fill', `url(#${gradientId})`)
        .attr('stroke', cat.color)
        .attr('stroke-width', 2) // Thicker stroke
        .attr('stroke-opacity', 0.5) // More visible
        .style('stroke-dasharray', '4 2'); // Dashed line

      catGroup
        .append('text')
        .attr('x', circle.x)
        .attr('y', circle.y - circle.radius - 10) // Slightly closer
        .attr('text-anchor', 'middle')
        .attr('font-weight', '700')
        .attr('fill', cat.color)
        .attr('font-size', '14px') // Smaller category text (was 16px)
        .style('text-transform', 'uppercase')
        .style('letter-spacing', '1px')
        .style('text-shadow', '0 2px 4px rgba(0,0,0,0.8)')
        .text(cat.name);
    });

    // --- 1. Group Simulation (Macro Layout) ---
    // This simulation manages the "Virtual Circles" (intersection groups).
    // They are attracted to their Venn center but push each other away.
    const groupSimulation = d3
      .forceSimulation<GroupNode>(groups)
      .force('x', d3.forceX<GroupNode>((d) => d.targetX).strength(0.1)) // Gentle pull to center
      .force('y', d3.forceY<GroupNode>((d) => d.targetY).strength(0.1))
      .force('collide', d3.forceCollide<GroupNode>((d) => d.r).strength(1)); // Strong collision

    // --- 2. Skill Simulation (Micro Layout) ---
    // Skills are attracted to their Group Node's current position.
    const skillSimulation = d3
      .forceSimulation<SkillNode>(nodes)
      .force(
        'collide',
        d3.forceCollide<SkillNode>((d) => d.r + 2).iterations(2), // Tight packing
      )
      .force('charge', d3.forceManyBody().strength(-20)); // prevent overlap glitch

    // Custom force to pull skills to their dynamic group center
    const forceClumpToGroup = (alpha: number) => {
      nodes.forEach((d) => {
        const group = groups.find((g) => g.id === d.groupId);
        if (group) {
          // k determines how tight the cluster is. stronger k = tighter.
          const k = 0.05 * alpha;
          d.vx! += (group.x! - d.x!) * k;
          d.vy! += (group.y! - d.y!) * k;
        }
      });
    };

    // Custom force to respect Venn boundaries
    const forceBoundary = (alpha: number) => {
      nodes.forEach((d) => {
        Object.entries(vennCircles).forEach(([catId, circle]) => {
          const isMember = d.categories.includes(catId);
          const dx = d.x! - circle.x;
          const dy = d.y! - circle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (isMember) {
            // Stay INSIDE: If dist > radius, push IN
            if (dist > circle.radius - d.r) {
              const k = (dist - (circle.radius - d.r)) * 5 * alpha;
              d.vx! -= (dx / dist) * k;
              d.vy! -= (dy / dist) * k;
            }
          } else {
            // Stay OUTSIDE: If dist < radius, push OUT
            // This prevents "A" skills from drifting into "B" circle (the overlap zone)
            if (dist < circle.radius + d.r) {
              const k = (circle.radius + d.r - dist) * 0.8 * alpha; // Stronger push out
              d.vx! += (dx / dist) * k;
              d.vy! += (dy / dist) * k;
            }
          }
        });
      });
    };

    // Chain simulations
    // We update skill targets based on group positions in every tick
    skillSimulation.on('tick', () => {
      // Apply custom clumping force manually since standard forceX/Y takes static or accessor,
      // but we want to efficiently read from the mutable group objects.
      forceClumpToGroup(skillSimulation.alpha());
      forceBoundary(skillSimulation.alpha()); // Apply boundary constraints

      skillNodes.attr('transform', (d) => `translate(${d.x},${d.y})`);

      // OPTIONAL: Draw Group Circles for Debugging
      // groupCircles.attr('cx', d => d.x!).attr('cy', d => d.y!);
    });

    // Sync group simulation ticking (it updates the group.x/y which skillSim reads)
    // We don't need a visual update for groups unless debugging
    groupSimulation.nodes(groups);

    // Render Skills
    const skillGroup = container.append('g').attr('class', 'skills');

    const skillNodes = skillGroup
      .selectAll<SVGGElement, SkillNode>('g')
      .data(nodes)
      .join('g')
      .call(drag(skillSimulation, groupSimulation)); // Modified drag to wake up both?

    // Skill Circle - Glassmorphism style
    // 1. Base Body (Transparent Fill)
    skillNodes
      .append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', 'rgba(255, 255, 255, 0.03)') // Very transparent fill
      .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))');

    // 2. Colored Outlines (Partial Arcs)
    skillNodes.each(function (d) {
      if (!d.categories || d.categories.length === 0) return;
      const g = d3.select(this);

      const arcGen = d3
        .arc<any>()
        .innerRadius(d.r)
        .outerRadius(d.r)
        .cornerRadius(0);

      const pie = d3
        .pie<string>()
        .value(1) // Equal size segments
        .sort(null); // Keep order of categories

      const arcsData = pie(d.categories);

      g.selectAll('path.skill-stroke')
        .data(arcsData)
        .join('path')
        .attr('class', 'skill-stroke')
        .attr('d', (a) => arcGen(a as any)) // Cast to any to calm TS for simple arc usage
        .attr('fill', 'none')
        .attr('stroke', (a) => {
          const cat = categoryMap.get(a.data);
          return cat ? cat.color : '#ccc';
        })
        .attr('stroke-width', 2) // Thicker for visibility
        .attr('stroke-opacity', 0.8)
        .style('stroke-linecap', d.categories.length > 1 ? 'butt' : 'round');
    });

    // Skill Label
    skillNodes
      .append('text')
      .attr('y', (d) => -d.r - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px') // Smaller skill text (was 10px)
      .attr('font-weight', '500')
      .attr('fill', '#e0e0e0')
      .text((d) => d.name)
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 2px 4px rgba(0,0,0,0.8)'); // Better readability

    // --- Render People inside Skills ---
    skillNodes.each(function (d) {
      if (!d.people || d.people.length === 0) return;
      const g = d3.select(this);

      g.selectAll('circle.person')
        .data(d.people)
        .join('circle')
        .attr('class', 'person')
        .attr('cx', (p) => p.x!)
        .attr('cy', (p) => p.y!)
        .attr('r', 3) // Smaller person dots
        .attr('fill', (p) => {
          // Use Proficiency colors aligned with theme
          // Expert: Purple, Advanced: Green, Intermediate: Orange
          if (p.proficiency === 'expert') return '#9b59b6';
          if (p.proficiency === 'advanced') return '#27ae60';
          if (p.proficiency === 'intermediate') return '#f39c12';
          return '#95a5a6'; // Beginner
        })
        .attr('stroke', 'rgba(255,255,255,0.8)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer') // Add cursor pointer
        .on('click', (event, p) => {
          event.stopPropagation(); // Prevent drag interference if any
          // Find full member object
          const fullMember = skillsData.members.find((m) => m.id === p.id);
          if (fullMember && onMemberClick) {
            onMemberClick(fullMember as Member);
          }
        })
        .style('filter', 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))')
        .append('title')
        .text((p) => `${p.name} (${p.role})\n${p.proficiency}`);
    });

    // Cleanup
    return () => {
      skillSimulation.stop();
      groupSimulation.stop();
    };
  }, [nodes, groups, vennCircles, dimensions, onMemberClick]);

  // Drag Helper
  function drag(
    simulation: d3.Simulation<SkillNode, undefined>,
    groupSim: d3.Simulation<GroupNode, undefined>,
  ) {
    function dragstarted(
      event: d3.D3DragEvent<SVGGElement, SkillNode, unknown>,
      d: SkillNode,
    ) {
      if (!event.active) {
        simulation.alphaTarget(0.3).restart();
        groupSim.alphaTarget(0.1).restart(); // Wake up groups too so they can move if pushed by dragged skill? (Currently 1-way, but good for liveness)
      }
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(
      event: d3.D3DragEvent<SVGGElement, SkillNode, unknown>,
      d: SkillNode,
    ) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(
      event: d3.D3DragEvent<SVGGElement, SkillNode, unknown>,
      d: SkillNode,
    ) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag<SVGGElement, SkillNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  return (
    <div className='w-full h-full flex items-center justify-center p-4'>
      {/* Changed container to transparent/glass style to match theme */}
      <svg
        ref={svgRef}
        className='w-full h-full'
        style={{
          height: propHeight ? `${propHeight}px` : '100%',
          maxHeight: '80vh', // Limit to viewport height as requested
        }}
        xmlns='http://www.w3.org/2000/svg'
      />
    </div>
  );
};

export default SkillChart;
