import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';

import skillsData from '../../public/data/skillsData.json';
import * as venn from '../utils/d3-venn';
import type { Area } from '../utils/d3-venn';
import type { SkillsData } from '../types/types';
import { PROFICIENCY_COLORS } from '../types/types';

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
      const minRadius = 1; // Slightly larger for pie chart visibility
      const calculatedRadius = Math.max(
        minRadius,
        Math.sqrt(peopleInSkill.length) * 5 + 5, // Adjusted scaling
      );

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
        people: peopleInSkill, // No longer need x/y from pack
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

    // Handle background click to reset zoom
    svg.on('click', () => {
      resetZoom();
    });

    svg.call(zoom);

    // Zoom focus helper
    const zoomToNode = (d: SkillNode) => {
      if (d.x === undefined || d.y === undefined) return;
      const zoomLevel = 4;
      const transform = d3.zoomIdentity
        .translate(dimensions.width / 2, dimensions.height / 2)
        .scale(zoomLevel)
        .translate(-d.x, -d.y);

      svg.transition().duration(750).call(zoom.transform, transform);

      // Fade out others
      container.selectAll('.skills g').transition().duration(500).style('opacity', 0.1);
      container.selectAll('.categories circle').transition().duration(500).style('opacity', 0.05);
      container.selectAll('.categories text').transition().duration(500).style('opacity', 0.05);
      
      // Highlight selected
      const selectedGroup = container.selectAll('.skills g')
        .filter((node: any) => node.id === d.id);
        
      selectedGroup
        .transition().duration(500)
        .style('opacity', 1);

      // Show names and lines for the focused skill
      selectedGroup.selectAll('.name-label')
        .transition().duration(500)
        .style('opacity', 1);
        
      selectedGroup.selectAll('.name-link')
        .transition().duration(500)
        .style('opacity', 0.5);
    };

    const resetZoom = () => {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
       
      // Restore opacity
      container.selectAll('.skills g').transition().duration(500).style('opacity', 1);
      container.selectAll('.categories circle').transition().duration(500).style('opacity', 1);
      container.selectAll('.categories text').transition().duration(500).style('opacity', 1);

      // Hide names and lines
      container.selectAll('.name-label').transition().duration(500).style('opacity', 0);
      container.selectAll('.name-link').transition().duration(500).style('opacity', 0);
    };

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
          const k = 0.1 * alpha;
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
              const k = (dist - (circle.radius - d.r)) * 0.1 * alpha;
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

    // --- Skill Pie Chart ---

    // 1. Label background (optional, for legibility if needed, but we used stroke before)
    // We already have strokes for categories. Let's keep the category awareness
    // but maybe as an outer ring or just implicit in position.
    // The user wants "pie chart". So the *body* of the circle is the pie.

    skillNodes.each(function (d) {
      const g = d3.select(this);

      // Pie Generator
      const pie = d3
        .pie<PersonNode>()
        .value(1) // Equal size slices for members
        .padAngle(0.1) // Add gap between slices
        .sort((a, b) => {
          // Sort by proficiency so colors are grouped
          const order = {
            expert: 0,
            advanced: 1,
            intermediate: 2,
            beginner: 3,
          };
          return (
            (order[a.proficiency as keyof typeof order] || 4) -
            (order[b.proficiency as keyof typeof order] || 4)
          );
        });

      const arcGen = d3
        .arc<d3.PieArcDatum<PersonNode>>()
        .innerRadius(0)
        .outerRadius(d.r)
        .cornerRadius(3); // Round corners

      const pieData = pie(d.people);

      // Render Slices
      g.selectAll('path.slice')
        .data(pieData)
        .join('path')
        .attr('class', 'slice')
        .attr('d', arcGen)
        .attr('fill', (slice) => {
          const p = slice.data;
          // Use centralized vibrant palette
          // Expert: Pinkish Purple, Advanced: Bright Blue, Intermediate: Emerald Green
          if (p.proficiency === 'expert') return PROFICIENCY_COLORS.expert;
          if (p.proficiency === 'advanced') return PROFICIENCY_COLORS.advanced;
          if (p.proficiency === 'intermediate')
            return PROFICIENCY_COLORS.intermediate;
          return PROFICIENCY_COLORS.beginner;
        })
        // Removed heavy stroke, using padAngle for separation
        .style('cursor', 'pointer')
        .style('transition', 'opacity 0.2s')
        .on('mouseover', function () {
          d3.select(this).style('opacity', 0.8);
        })
        .on('mouseout', function () {
          d3.select(this).style('opacity', 1);
        })
        .on('click', (event, slice) => {
          event.stopPropagation();
          zoomToNode(d);
          const fullMember = skillsData.members.find(
            (m) => m.id === slice.data.id,
          );
          if (fullMember && onMemberClick) {
            onMemberClick(fullMember as Member);
          }
        })
        .append('title')
        .text(
          (slice) =>
            `${slice.data.name} (${slice.data.role})\n${slice.data.proficiency}`,
        );

      // Label Arc Generator (for positioning outside)
      const labelRadius = d.r + 8; // Distance for the end of the line
      const labelArc = d3
        .arc<d3.PieArcDatum<PersonNode>>()
        .innerRadius(labelRadius)
        .outerRadius(labelRadius);

      // Connectors (Lines)
      g.selectAll('polyline.name-link')
        .data(pieData)
        .join('polyline')
        .attr('class', 'name-link')
        .attr('points', (d) => {
          const posA = arcGen.centroid(d); // Center of slice
          const posB = labelArc.centroid(d); // Outside point
          return [posA, posB] as any;
        })
        .style('fill', 'none')
        .style('stroke', '#fff')
        .style('stroke-width', '0.5px')
        .style('opacity', 0) // Hidden by default
        .style('pointer-events', 'none');

      // Labels (Text)
      g.selectAll('text.name-label')
        .data(pieData)
        .join('text')
        .attr('class', 'name-label')
        .attr('transform', (d) => {
          // Push text slightly further out from the line end
          const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          const x = Math.sin(midAngle) * (labelRadius + 2);
          const y = -Math.cos(midAngle) * (labelRadius + 2);
          return `translate(${x}, ${y})`;
        })
        .attr('dy', '0.35em')
        .attr('text-anchor', (d) => {
          // Calculate angle to decide anchor. 
          // D3 Arc 0 is at 12 o'clock, increasing clockwise.
          // 0 -> PI (Right side): start? No.
          // 0 is up. PI/2 is right. PI is down. 3PI/2 is left.
          const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          if (midAngle > Math.PI && midAngle < Math.PI * 2) {
             return 'end'; // Left side
          }
           return 'start'; // Right side
        })
        // Correction: The simple radial push above might overlap. 
        // But for equal slices it might be okay. 
        // Let's rely on radial alignment for now.
        .attr('text-anchor', 'middle') // Radial looks best if radiating out
        .text((d) => d.data.name.split(' ')[0]) 
        .style('font-size', '3px') 
        .style('font-weight', '600')
        .style('fill', '#fff')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)')
        .style('opacity', 0) 
        .style('pointer-events', 'none');

      // 2. Outer Ring for Categories (Visual Context)
      if (d.categories && d.categories.length > 0) {
        const ringArcGen = d3
          .arc<any>()
          .innerRadius(d.r + 3) // Slightly further out
          .outerRadius(d.r + 5)
          .cornerRadius(2);

        const ringPie = d3.pie<string>().value(1).padAngle(0.05).sort(null);

        const ringData = ringPie(d.categories);

        g.selectAll('path.cat-ring')
          .data(ringData)
          .join('path')
          .attr('class', 'cat-ring')
          .attr('d', (a) => ringArcGen(a as any))
          .attr('fill', (a) => {
            const cat = categoryMap.get(a.data);
            return cat ? cat.color : '#ccc';
          })
          .attr('fill-opacity', 0.9)
          .style('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation();
            zoomToNode(d);
          });
      }
    });

    // Skill Label (on top of pie)
    // Add a text background for readability?
    skillNodes
      .append('text')
      .attr('y', (d) => -d.r - 10) // Lift slightly higher
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px') // Slightly larger
      .attr('font-weight', '700')
      .attr('fill', '#fff')
      .text((d) => d.name)
      .style('cursor', 'pointer') // Make it look clickable
      .style(
        'text-shadow',
        '0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.5)',
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        zoomToNode(d);
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
