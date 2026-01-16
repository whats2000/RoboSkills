import React, { useMemo, useState } from 'react';
import {
  Table,
  Tag,
  Progress,
  Card,
  Row,
  Col,
  Statistic,
  Empty,
  Spin,
} from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useSkillsData, calculateSkillGaps } from '../hooks/useSkillsData';
import type { SkillGap } from '../types/types';
import GapDistributionChart from '../components/GapDistributionChart';

export const GapAnalysisPage: React.FC = () => {
  const { data, loading, error } = useSkillsData();

  const gaps = useMemo(() => {
    if (!data) return [];
    return calculateSkillGaps(data);
  }, [data]);

  const stats = useMemo(() => {
    if (!gaps.length) return { noExpert: 0, noCoverage: 0, healthy: 0 };
    return {
      noCoverage: gaps.filter((g) => g.currentCoverage === 0).length,
      noExpert: gaps.filter((g) => g.currentCoverage > 0 && g.expertCount === 0)
        .length,
      healthy: gaps.filter((g) => g.expertCount > 0 && g.currentCoverage >= 2)
        .length,
    };
  }, [gaps]);

  // State for chart filtering - must be before any early returns
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter gaps based on selected category from chart
  const filteredGaps = useMemo(() => {
    if (!selectedCategory) return gaps;
    return gaps.filter((gap) =>
      gap.categories.some((cat) => cat.id === selectedCategory),
    );
  }, [gaps, selectedCategory]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <Spin size='large' tip='Analyzing skill gaps...' fullscreen />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className='flex items-center justify-center h-96'>
        <Empty description={error || 'No data available'} />
      </div>
    );
  }

  const columns = [
    {
      title: 'Skill',
      dataIndex: ['skill', 'name'],
      key: 'skill',
      render: (text: string, record: SkillGap) => (
        <div>
          <span className='font-medium text-white'>{text}</span>
          {record.categories.length > 1 && (
            <span className='ml-2 text-xs text-indigo-400'>⟷ overlap</span>
          )}
        </div>
      ),
    },
    {
      title: 'Categories',
      key: 'categories',
      render: (_: unknown, record: SkillGap) => (
        <div className='flex flex-wrap gap-1'>
          {record.categories.map((cat) => (
            <Tag
              key={cat.id}
              style={{
                backgroundColor: `${cat.color}20`,
                color: cat.color,
                border: `1px solid ${cat.color}`,
              }}
            >
              {cat.name}
            </Tag>
          ))}
        </div>
      ),
      filters: data.categories.map((c) => ({ text: c.name, value: c.id })),
      onFilter: (value: React.Key | boolean, record: SkillGap) =>
        record.categories.some((cat) => cat.id === value),
    },
    {
      title: 'Coverage',
      dataIndex: 'currentCoverage',
      key: 'coverage',
      sorter: (a: SkillGap, b: SkillGap) =>
        a.currentCoverage - b.currentCoverage,
      render: (count: number) => {
        const maxExpected = 3;
        const percent = Math.min((count / maxExpected) * 100, 100);
        const status =
          count === 0 ? 'exception' : count < 2 ? 'normal' : 'success';
        return (
          <div className='flex items-center gap-2'>
            <Progress
              percent={percent}
              steps={3}
              size='small'
              status={status}
              showInfo={false}
            />
            <span className='text-gray-400 text-sm'>{count} members</span>
          </div>
        );
      },
    },
    {
      title: 'Experts',
      dataIndex: 'expertCount',
      key: 'experts',
      sorter: (a: SkillGap, b: SkillGap) => a.expertCount - b.expertCount,
      render: (count: number) => (
        <span className={count === 0 ? 'text-orange-400' : 'text-green-400'}>
          {count} {count === 1 ? 'expert' : 'experts'}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: SkillGap) => {
        if (record.currentCoverage === 0) {
          return (
            <Tag icon={<WarningOutlined />} color='error'>
              No Coverage
            </Tag>
          );
        }
        if (record.expertCount === 0) {
          return (
            <Tag icon={<ExclamationCircleOutlined />} color='warning'>
              No Expert
            </Tag>
          );
        }
        if (record.currentCoverage < 2) {
          return (
            <Tag icon={<ExclamationCircleOutlined />} color='warning'>
              Limited
            </Tag>
          );
        }
        return (
          <Tag icon={<CheckCircleOutlined />} color='success'>
            Healthy
          </Tag>
        );
      },
    },
    {
      title: 'Recommendation',
      dataIndex: 'recommendation',
      key: 'recommendation',
      render: (text: string) =>
        text ? (
          <span className='text-gray-400 text-sm italic'>{text}</span>
        ) : (
          <span className='text-green-400 text-sm'>✓ Good coverage</span>
        ),
    },
  ];

  // Find skills that span the most categories (potential collaboration points)
  const crossDomainSkills = gaps
    .filter((g) => g.categories.length >= 2)
    .sort((a, b) => b.categories.length - a.categories.length)
    .slice(0, 5);

  return (
    <div className='space-y-8'>
      {/* Header */}
      <div className='text-center'>
        <h1 className='text-4xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent mb-4'>
          Gap Analysis
        </h1>
        <p className='text-gray-400 max-w-2xl mx-auto'>
          Identify skill gaps and cross-domain opportunities. Skills spanning
          multiple categories are key collaboration points.
        </p>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className='glass-card'>
            <Statistic
              title={<span className='text-gray-400'>No Coverage</span>}
              value={stats.noCoverage}
              styles={{ content: { color: '#ef4444' } }}
              prefix={<WarningOutlined />}
              suffix='skills'
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className='glass-card'>
            <Statistic
              title={<span className='text-gray-400'>No Expert</span>}
              value={stats.noExpert}
              styles={{ content: { color: '#f59e0b' } }}
              prefix={<ExclamationCircleOutlined />}
              suffix='skills'
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className='glass-card'>
            <Statistic
              title={<span className='text-gray-400'>Healthy</span>}
              value={stats.healthy}
              styles={{ content: { color: '#22c55e' } }}
              prefix={<CheckCircleOutlined />}
              suffix='skills'
            />
          </Card>
        </Col>
      </Row>

      {/* Distribution Chart */}
      <Card className='glass-card !mb-10'>
        <h2 className='text-xl font-semibold text-white mb-4'>
          📊 Skill Distribution Overview
        </h2>
        <p className='text-gray-400 text-sm mb-4'>
          Inner ring shows categories, outer ring shows skills colored by health
          status. Click a category to filter, click a skill to see team
          expertise details.
        </p>
        <GapDistributionChart
          gaps={gaps}
          categories={data.categories}
          members={data.members}
        />
      </Card>

      {/* Cross-Domain Skills */}
      <Card className='glass-card !mb-10'>
        <h2 className='text-xl font-semibold text-white mb-4'>
          🔗 Cross-Domain Skills (Collaboration Opportunities)
        </h2>
        <p className='text-gray-400 text-sm mb-4'>
          These skills span multiple categories - great for interdisciplinary
          collaboration.
        </p>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {crossDomainSkills.map((gap) => (
            <div
              key={gap.skill.id}
              className='p-4 rounded-lg bg-white/5 border border-white/10'
            >
              <h3 className='font-medium text-white mb-2'>{gap.skill.name}</h3>
              <div className='flex flex-wrap gap-1 mb-2'>
                {gap.categories.map((cat) => (
                  <span
                    key={cat.id}
                    className='text-xs px-2 py-0.5 rounded-full'
                    style={{
                      backgroundColor: `${cat.color}20`,
                      color: cat.color,
                    }}
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
              <div className='text-sm text-gray-400'>
                {gap.currentCoverage} members • {gap.expertCount} experts
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Gap Table */}
      <Card className='glass-card !mb-10'>
        <h2 className='text-xl font-semibold text-white mb-4'>
          All Skills Coverage
        </h2>
        <Table
          dataSource={filteredGaps}
          columns={columns}
          rowKey={(record) => record.skill.id}
          pagination={{ pageSize: 10 }}
          className='skill-gap-table'
          style={{ background: 'transparent' }}
        />
      </Card>

      {/* Collaboration Suggestions */}
      <Card className='glass-card'>
        <h2 className='text-xl font-semibold text-white mb-4'>
          Potential External Collaborations
        </h2>
        <div className='space-y-4'>
          {gaps
            .filter((g) => g.currentCoverage === 0)
            .slice(0, 3)
            .map((gap) => (
              <div
                key={gap.skill.id}
                className='p-4 rounded-lg'
                style={{
                  background: `linear-gradient(90deg, ${gap.categories.map((c) => `${c.color}20`).join(', ')})`,
                  borderLeft: `4px solid ${gap.categories[0]?.color}`,
                }}
              >
                <h3 className='font-medium text-white'>{gap.skill.name}</h3>
                <p className='text-gray-400 text-sm mt-1'>
                  Consider reaching out to labs specializing in{' '}
                  {gap.categories.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 &&
                        (i === gap.categories.length - 1 ? ' or ' : ', ')}
                      <span style={{ color: c.color }}>{c.name}</span>
                    </span>
                  ))}{' '}
                  for potential collaboration.
                </p>
              </div>
            ))}
          {gaps.filter((g) => g.currentCoverage === 0).length === 0 && (
            <p className='text-gray-400'>
              Great news! All skill areas have at least some coverage.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default GapAnalysisPage;
