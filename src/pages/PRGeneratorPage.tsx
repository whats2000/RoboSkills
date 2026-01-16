import React, { useState } from 'react';
import {
  Form,
  Input,
  Select,
  AutoComplete,
  Button,
  Card,
  Modal,
  message,
  Divider,
  Tag,
  Space,
  Empty,
  Spin,
  Checkbox,
} from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  GithubOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useSkillsData, getSkillById } from '../hooks/useSkillsData';
import type {
  LabMember,
  MemberSkill,
  ProficiencyLevel,
  Subcategory,
} from '../types/types';
import { PROFICIENCY_LABELS } from '../types/types';

const { TextArea } = Input;
const { Option } = Select;

const COMMON_ROLES = [
  'Professor',
  'Postdoc',
  'PhD Student',
  'Master Student',
  'Undergraduate Student',
  'Research Assistant',
  'Visiting Scholar',
  'Alumni',
];

interface MemberFormData {
  name: string;
  role: string;
  email?: string;
  github?: string;
}

export const PRGeneratorPage: React.FC = () => {
  const { data, loading, error } = useSkillsData();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const [skills, setSkills] = useState<MemberSkill[]>([]);
  const [prContent, setPrContent] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<'new' | 'edit'>('new');
  const [selectedMember, setSelectedMember] = useState<LabMember | null>(null);

  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategories, setNewSkillCategories] = useState<string[]>([]);
  const [githubToken, setGithubToken] = useState('');
  const [creatingPR, setCreatingPR] = useState(false);
  const [prType, setPrType] = useState<
    'member' | 'skill' | 'delete-member' | null
  >(null);
  const [hasChanges, setHasChanges] = useState(false);

  const createPR = async () => {
    const sanitizedToken = githubToken.trim();
    if (!sanitizedToken) {
      void messageApi.error(
        'Please enter a valid GitHub Personal Access Token',
      );
      return;
    }

    setCreatingPR(true);
    try {
      const { Octokit } = await import('octokit');
      const octokit = new Octokit({ auth: sanitizedToken });

      const UPSTREAM_OWNER = 'whats2000';
      const UPSTREAM_REPO = 'RoboSkills';
      const FILE_PATH = 'public/data/skillsData.json';
      const BRANCH_NAME = `content-update-${Date.now()}`;

      // 0. Get current authenticated user
      const { data: user } = await octokit.request('GET /user');
      const currentUser = user.login;

      // Determine where to create branch/commit (Origin)
      // If user is the upstream owner, use upstream. Otherwise assume fork.
      const branchOwner =
        currentUser === UPSTREAM_OWNER ? UPSTREAM_OWNER : currentUser;
      const branchRepo = UPSTREAM_REPO; // Assuming fork has same name, reasonable default

      // Check if fork exists/user has access
      try {
        await octokit.request('GET /repos/{owner}/{repo}', {
          owner: branchOwner,
          repo: branchRepo,
        });
      } catch (e) {
        if (branchOwner !== UPSTREAM_OWNER) {
          throw new Error(
            `Could not find repository ${branchOwner}/${branchRepo}. Please fork the repository first.`,
          );
        } else {
          throw e;
        }
      }

      // 1. Get current Main SHA from UPSTREAM (to ensure we base off latest official)
      await octokit.request('GET /repos/{owner}/{repo}/git/ref/heads/main', {
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
      });

      // 2. Create new branch on ORIGIN (User's fork or Upstream)
      // We will base the new branch on the main branch of the ORIGIN repo.
      try {
        // Get Main SHA from ORIGIN (Fork) to ensure existence
        const { data: originRef } = await octokit.request(
          'GET /repos/{owner}/{repo}/git/ref/heads/main',
          {
            owner: branchOwner,
            repo: branchRepo,
          },
        );
        const originSha = originRef.object.sha;

        await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
          owner: branchOwner,
          repo: branchRepo,
          ref: `refs/heads/${BRANCH_NAME}`,
          sha: originSha,
        });
      } catch (e: any) {
        console.error('Failed to create branch on origin', e);
        throw new Error(
          `Failed to create branch on ${branchOwner}/${branchRepo}. Ensure the fork exists and your token has "repo" scope.`,
        );
      }

      // 3. Get current file content from UPSTREAM (to edit latest version)
      const { data: fileData } = await octokit.request(
        'GET /repos/{owner}/{repo}/contents/{path}',
        {
          owner: UPSTREAM_OWNER,
          repo: UPSTREAM_REPO,
          path: FILE_PATH,
        },
      );

      if (!Array.isArray(fileData) && fileData.type === 'file') {
        const decodedContent = atob(fileData.content.replace(/\n/g, ''));
        const currentContent = JSON.parse(decodedContent);

        // Update content locally
        const updatedContent = { ...currentContent };

        if (prType === 'member') {
          if (editMode === 'new' && !selectedMember) {
            // Adding a new member
            const memberId = `member-${Date.now()}`;
            const newMember = {
              id: memberId,
              name: form.getFieldValue('name'),
              role: form.getFieldValue('role'),
              email: form.getFieldValue('email'),
              github: form.getFieldValue('github'),
              skills: skills,
            };
            updatedContent.members.push(newMember);
          } else if (editMode === 'edit' && selectedMember) {
            // Updating member
            const updatedMember = {
              ...selectedMember,
              name: form.getFieldValue('name'),
              role: form.getFieldValue('role'),
              email: form.getFieldValue('email'),
              github: form.getFieldValue('github'),
              skills: skills,
            };
            updatedContent.members = updatedContent.members.map((m: any) =>
              m.id === selectedMember.id ? updatedMember : m,
            );
          }
        } else if (prType === 'delete-member' && selectedMember) {
          updatedContent.members = updatedContent.members.filter(
            (m: any) => m.id !== selectedMember.id,
          );
        } else if (prType === 'skill') {
          const skillId = newSkillName.toLowerCase().replace(/\s+/g, '-');
          const newSkill = {
            id: skillId,
            name: newSkillName,
            description: `Description for ${newSkillName}`,
            belongsTo: newSkillCategories,
          };
          updatedContent.skills.push(newSkill);
        }

        // 4. Commit file update to ORIGIN (Fork)
        // We need to get the SHA of the file in the FORK if it exists, roughly.
        // Actually, for 'create/update' file API, we need the blob SHA of the file we are replacing.
        // If we are on a new branch on the fork, the file is same as wherever we branched from.
        // But the API requires strict SHA matching for updates.
        // We read from UPSTREAM. If we write to FORK, does the fork have this file? Yes.
        // But does it have the SAME sha? Maybe not if fork is outdated.
        // Safer: Get file SHA from the branch we just created on ORIGIN.

        const { data: branchFileData } = await octokit.request(
          'GET /repos/{owner}/{repo}/contents/{path}',
          {
            owner: branchOwner,
            repo: branchRepo,
            path: FILE_PATH,
            ref: BRANCH_NAME,
          },
        );

        if (Array.isArray(branchFileData) || branchFileData.type !== 'file') {
          throw new Error('Unexpected file type in branch');
        }

        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
          owner: branchOwner,
          repo: branchRepo,
          path: FILE_PATH,
          message: `chore: ${
            prType === 'delete-member' && selectedMember
              ? `remove member ${selectedMember.name}`
              : `update data for ${prType === 'skill' ? newSkillName : form.getFieldValue('name')}`
          }`,
          content: btoa(JSON.stringify(updatedContent, null, 2)),
          branch: BRANCH_NAME,
          sha: branchFileData.sha,
        });

        // 5. Create PR on UPSTREAM
        // Head: if different repo, username:branch
        const headRef =
          branchOwner === UPSTREAM_OWNER
            ? BRANCH_NAME
            : `${branchOwner}:${BRANCH_NAME}`;

        let prTitle = '';
        if (prType === 'skill') {
          prTitle = `Update: ${newSkillName}`;
        } else if (prType === 'delete-member' && selectedMember) {
          prTitle = `Remove Member: ${selectedMember.name}`;
        } else {
          prTitle = `Update: ${form.getFieldValue('name')}`;
        }

        const { data: prData } = await octokit.request(
          'POST /repos/{owner}/{repo}/pulls',
          {
            owner: UPSTREAM_OWNER,
            repo: UPSTREAM_REPO,
            title: prTitle,
            body: prContent,
            head: headRef,
            base: 'main',
          },
        );

        void messageApi.success('Pull Request created successfully!');
        window.open(prData.html_url, '_blank');
        setModalOpen(false);
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.message.includes('refs')
        ? 'Failed to create branch. Check Token Scopes (needs "repo") or Fork status.'
        : error.message;
      void messageApi.error(`Failed: ${msg}`);
    } finally {
      setCreatingPR(false);
    }
  };

  // Calculate role options mixing common roles and existing roles
  const roleOptions = React.useMemo(() => {
    if (!data) return [];

    const existingRoles = new Set(data.members.map((m) => m.role));
    const allRoles = new Set([...COMMON_ROLES, ...existingRoles]);

    return Array.from(allRoles)
      .sort()
      .map((role) => ({
        value: role,
        label: role,
      }));
  }, [data]);

  // --- Change Detection Logic ---
  const checkForChanges = (
    currentFormValues: MemberFormData,
    currentSkills: MemberSkill[],
  ) => {
    if (editMode === 'new') {
      // For new profile, enable if name and role are present
      return !!currentFormValues.name && !!currentFormValues.role;
    }

    if (!selectedMember) return false;

    const nameChanged = currentFormValues.name !== selectedMember.name;
    const roleChanged = currentFormValues.role !== selectedMember.role;
    const emailChanged =
      (currentFormValues.email || '') !== (selectedMember.email || '');
    const githubChanged =
      (currentFormValues.github || '') !== (selectedMember.github || '');

    // Compare skills
    if (currentSkills.length !== selectedMember.skills.length) return true;

    const sortedCurrent = [...currentSkills].sort((a, b) =>
      a.skillId.localeCompare(b.skillId),
    );
    const sortedOriginal = [...selectedMember.skills].sort((a, b) =>
      a.skillId.localeCompare(b.skillId),
    );
    const skillsChanged =
      JSON.stringify(sortedCurrent) !== JSON.stringify(sortedOriginal);

    return (
      nameChanged ||
      roleChanged ||
      emailChanged ||
      githubChanged ||
      skillsChanged
    );
  };

  // Trigger check when skills change
  React.useEffect(() => {
    const values = form.getFieldsValue();
    setHasChanges(checkForChanges(values, skills));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, editMode, selectedMember]);

  const onFormValuesChange = (_: any, allValues: MemberFormData) => {
    setHasChanges(checkForChanges(allValues, skills));
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <Spin size='large' tip='Loading data...' fullscreen={true} />
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

  const addSkill = (skillId: string, proficiency: ProficiencyLevel) => {
    const exists = skills.some((s) => s.skillId === skillId);
    if (!exists) {
      setSkills([...skills, { skillId, proficiency }]);
    }
  };

  const removeSkill = (skillId: string) => {
    setSkills(skills.filter((s) => s.skillId !== skillId));
  };

  const updateSkillProficiency = (
    skillId: string,
    proficiency: ProficiencyLevel,
  ) => {
    setSkills(
      skills.map((s) => (s.skillId === skillId ? { ...s, proficiency } : s)),
    );
  };

  const generatePRContent = (formData: MemberFormData) => {
    const memberId =
      editMode === 'edit' && selectedMember
        ? selectedMember.id
        : `member-${Date.now()}`;

    const newMember = {
      id: memberId,
      name: formData.name,
      role: formData.role,
      email: formData.email,
      github: formData.github,
      skills: skills,
    };

    const action = editMode === 'new' ? 'Add new' : 'Update';

    const content = `## ${action} Lab Member: ${formData.name}

### Description
This PR ${editMode === 'new' ? 'adds' : 'updates'} the profile for **${formData.name}** (${formData.role}).

### Changes to \`public/data/skillsData.json\`

${editMode === 'new' ? 'Add the following member to the `members` array:' : 'Replace the existing member entry with:'}

\`\`\`json
${JSON.stringify(newMember, null, 2)}
\`\`\`

### Skills Summary
${skills
  .map((s) => {
    const skill = getSkillById(data.skills, s.skillId);
    const categories = skill?.belongsTo
      .map((id) => data.categories.find((c) => c.id === id)?.name)
      .join(', ');
    return `- **${skill?.name}** (${PROFICIENCY_LABELS[s.proficiency]}) - spans: ${categories}`;
  })
  .join('\n')}

### Category Distribution
${(() => {
  const weights: Record<string, number> = {};
  for (const s of skills) {
    const skill = data.skills.find((sk) => sk.id === s.skillId);
    if (!skill) continue;
    for (const catId of skill.belongsTo) {
      weights[catId] = (weights[catId] || 0) + 1;
    }
  }
  return Object.entries(weights)
    .map(([catId, count]) => {
      const cat = data.categories.find((c) => c.id === catId);
      return `- ${cat?.name}: ${count} skills`;
    })
    .join('\n');
})()}

### Checklist
- [ ] Member information is accurate
- [ ] Skills are correctly assigned
- [ ] Proficiency levels are appropriate
`;

    setPrContent(content);
    setPrType('member');
    setModalOpen(true);
  };

  const generateRemoveMemberPR = () => {
    if (!selectedMember) return;

    const content = `## Remove Lab Member: ${selectedMember.name}

### Description
This PR removes the profile for **${selectedMember.name}** (${selectedMember.role}) from the lab members list.

### Changes to \`public/data/skillsData.json\`

Remove the member entry with ID \`${selectedMember.id}\`.

### Checklist
- [ ] Confirmed member departure or removal request
`;

    setPrContent(content);
    setPrType('delete-member');
    setModalOpen(true);
  };

  const generateNewSkillPR = () => {
    if (!newSkillName || newSkillCategories.length === 0) {
      void messageApi.warning(
        'Please provide skill name and select at least one category',
      );
      return;
    }

    const skillId = newSkillName.toLowerCase().replace(/\s+/g, '-');
    const newSkill: Subcategory = {
      id: skillId,
      name: newSkillName,
      description: `Description for ${newSkillName}`,
      belongsTo: newSkillCategories,
    };

    const content = `## Add New Skill: ${newSkillName}

### Description
This PR adds a new skill that spans across ${newSkillCategories.length} ${newSkillCategories.length === 1 ? 'category' : 'categories'}.

### Changes to \`public/data/skillsData.json\`

Add the following skill to the \`skills\` array:

\`\`\`json
${JSON.stringify(newSkill, null, 2)}
\`\`\`

### Category Overlap
This skill bridges the following domains:
${newSkillCategories
  .map((catId) => {
    const cat = data.categories.find((c) => c.id === catId);
    return `- **${cat?.name}**`;
  })
  .join('\n')}

### Checklist
- [ ] Skill name is appropriate
- [ ] Category associations are correct
- [ ] Description is accurate
`;

    setPrContent(content);
    setPrType('skill');
    setModalOpen(true);
  };

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(prContent);
    void messageApi.success('PR content copied to clipboard!');
  };

  const handleEditMember = (member: LabMember) => {
    setEditMode('edit');
    setSelectedMember(member);
    setSkills(member.skills);
    form.setFieldsValue({
      name: member.name,
      role: member.role,
      email: member.email,
      github: member.github,
    });
    setHasChanges(false); // Reset changes on select
  };

  const handleNewMember = () => {
    setEditMode('new');
    setSelectedMember(null);
    setSkills([]);
    form.resetFields();
    setHasChanges(false);
  };

  return (
    <div className='space-y-8'>
      {contextHolder}
      {/* Header */}
      <div className='text-center'>
        <h1 className='text-4xl font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent mb-4'>
          Data Update & PR Generator
        </h1>
        <p className='text-gray-400 max-w-2xl mx-auto'>
          Add or update lab member profiles and skills. Generate Pull Request
          content for data updates.
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Existing Members */}
        <Card className='glass-card lg:col-span-1'>
          <h2 className='text-lg font-semibold text-white mb-4'>
            Existing Members
          </h2>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={handleNewMember}
            className='w-full !mb-4'
          >
            Add New Member
          </Button>
          <div className='space-y-2 max-h-96 overflow-y-auto'>
            {data.members.map((member) => (
              <div
                key={member.id}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedMember?.id === member.id
                    ? 'bg-indigo-500/20 border border-indigo-500'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => handleEditMember(member)}
              >
                <h3 className='font-medium text-white'>{member.name}</h3>
                <p className='text-sm text-gray-400'>{member.role}</p>
                <p className='text-xs text-gray-500'>
                  {member.skills.length} skills
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Member Form */}
        <Card className='glass-card lg:col-span-2'>
          <h2 className='text-lg font-semibold text-white mb-4'>
            {editMode === 'new'
              ? 'New Member'
              : `Edit: ${selectedMember?.name}`}
          </h2>

          <Form
            form={form}
            layout='vertical'
            onFinish={generatePRContent}
            onValuesChange={onFormValuesChange}
          >
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <Form.Item
                name='name'
                label={<span className='text-gray-300'>Name</span>}
                rules={[{ required: true, message: 'Please enter name' }]}
              >
                <Input placeholder='John Doe' />
              </Form.Item>
              <Form.Item
                name='role'
                label={<span className='text-gray-300'>Role</span>}
                rules={[{ required: true, message: 'Please enter role' }]}
              >
                <AutoComplete
                  options={roleOptions}
                  placeholder='PhD Student'
                  filterOption={(inputValue, option) =>
                    option!.value
                      .toUpperCase()
                      .indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Form.Item>
              <Form.Item
                name='email'
                label={<span className='text-gray-300'>Email</span>}
              >
                <Input placeholder='john@lab.edu' />
              </Form.Item>
              <Form.Item
                name='github'
                label={<span className='text-gray-300'>GitHub Username</span>}
              >
                <Input prefix={<GithubOutlined />} placeholder='johndoe' />
              </Form.Item>
            </div>

            <Divider className='border-gray-700' />

            {/* Skill Selection */}
            <h3 className='text-white font-medium mb-4'>
              Skills (click to add)
            </h3>

            {/* Group skills by category */}
            {data.categories.map((category) => {
              const categorySkills = data.skills.filter((s) =>
                s.belongsTo.includes(category.id),
              );
              if (categorySkills.length === 0) return null;

              return (
                <div key={category.id} className='mb-4'>
                  <h4
                    className='text-sm font-medium mb-2'
                    style={{ color: category.color }}
                  >
                    {category.name}
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {categorySkills.map((skill) => {
                      const isSelected = skills.some(
                        (s) => s.skillId === skill.id,
                      );
                      const selectedSkill = skills.find(
                        (s) => s.skillId === skill.id,
                      );
                      const isOverlap = skill.belongsTo.length > 1;

                      return (
                        <div key={skill.id} className='flex items-center gap-1'>
                          <Tag
                            className={`cursor-pointer transition-all border ${
                              isSelected
                                ? 'text-white'
                                : 'bg-white/5 text-gray-400 border-gray-700 hover:text-gray-300 hover:border-gray-600'
                            }`}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: category.color,
                                    borderColor: category.color,
                                  }
                                : undefined
                            }
                            onClick={() => {
                              if (isSelected) {
                                removeSkill(skill.id);
                              } else {
                                addSkill(skill.id, 'intermediate');
                              }
                            }}
                          >
                            {skill.name}
                            {isOverlap && !isSelected && (
                              <span className='ml-1'>⟷</span>
                            )}
                          </Tag>
                          {isSelected && (
                            <Select
                              size='small'
                              value={selectedSkill?.proficiency}
                              onChange={(val) =>
                                updateSkillProficiency(skill.id, val)
                              }
                              style={{ width: 100 }}
                            >
                              {Object.entries(PROFICIENCY_LABELS).map(
                                ([val, label]) => (
                                  <Option key={val} value={val}>
                                    {label}
                                  </Option>
                                ),
                              )}
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Selected Skills Summary */}
            {skills.length > 0 && (
              <div className='mb-4 p-4 rounded-lg bg-white/5'>
                <h4 className='text-gray-300 text-sm mb-2'>
                  Selected: {skills.length} skills
                </h4>
              </div>
            )}

            <div className='flex gap-2'>
              <Button
                type='primary'
                htmlType='submit'
                icon={<GithubOutlined />}
                disabled={!hasChanges}
                className='flex-1'
              >
                Generate PR Content
              </Button>
              {editMode === 'edit' && selectedMember && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={generateRemoveMemberPR}
                >
                  Remove Member
                </Button>
              )}
            </div>
          </Form>
        </Card>
      </div>

      {/* Add New Skill Section */}
      <Card className='glass-card'>
        <h2 className='text-lg font-semibold text-white mb-4'>
          Add New Skill (with Category Overlap)
        </h2>
        <p className='text-gray-400 text-sm mb-4'>
          Create a new skill that can span multiple categories. Skills with
          multiple categories create overlap regions in the visualization.
        </p>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='text-gray-300 text-sm block mb-2'>
              Skill Name
            </label>
            <Input
              placeholder='e.g., Imitation Learning'
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
            />
          </div>
          <div className='md:col-span-2'>
            <label className='text-gray-300 text-sm block mb-2'>
              Belongs to Categories (select multiple for overlap)
            </label>
            <Checkbox.Group
              value={newSkillCategories}
              onChange={(values) => setNewSkillCategories(values as string[])}
            >
              <Space wrap>
                {data.categories.map((cat) => (
                  <Checkbox
                    key={cat.id}
                    value={cat.id}
                    style={{ color: cat.color }}
                  >
                    <span style={{ color: cat.color }}>{cat.name}</span>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </div>
        </div>
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={generateNewSkillPR}
          className='!mt-4'
          disabled={!newSkillName || newSkillCategories.length === 0}
        >
          Generate Skill PR
        </Button>
      </Card>

      {/* PR Content Modal */}
      <Modal
        title='Pull Request'
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={800}
        footer={null}
      >
        <div className='space-y-4'>
          <div className='bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg'>
            <h4 className='font-semibold text-blue-400 mb-2'>
              Automatic PR Creation
            </h4>
            <div className='text-sm text-gray-400 mb-3 space-y-2'>
              <p>
                Enter your GitHub Personal Access Token (PAT) to automatically
                create this PR.
              </p>
              <div className='bg-black/30 p-2 rounded text-xs'>
                <p className='font-semibold text-gray-300'>
                  Required Permissions:
                </p>
                <ul className='list-disc list-inside ml-1 space-y-1 mt-1'>
                  <li>
                    <span className='text-yellow-400'>repo</span> (Full control
                    of private repositories)
                  </li>
                  <li>
                    OR for Fine-grained tokens:
                    <span className='text-green-400'> Contents</span> (Read &
                    write) +
                    <span className='text-green-400'> Pull requests</span> (Read
                    & write)
                  </li>
                </ul>
              </div>
              <p>
                <a
                  href='https://github.com/settings/tokens/new?scopes=repo&description=RoboSkills%20PR%20Bot'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-400 hover:text-blue-300 underline'
                >
                  Click here to generate a token with 'repo' scope
                </a>
              </p>
            </div>
            <div className='flex gap-2'>
              <Input.Password
                placeholder='ghp_...'
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
              />
              <Button
                type='primary'
                loading={creatingPR}
                onClick={createPR}
                icon={<GithubOutlined />}
              >
                Create PR
              </Button>
            </div>
          </div>

          <Divider className='!my-4 border-gray-700'>
            OR Manual Creation
          </Divider>

          <TextArea
            value={prContent}
            rows={10}
            readOnly
            className='font-mono text-sm'
            style={{ background: '#1a1a2e', color: '#fff' }}
          />

          <div className='flex justify-end gap-2 mt-4'>
            <Button onClick={() => setModalOpen(false)}>Close</Button>
            <Button
              type='default'
              icon={<CopyOutlined />}
              onClick={copyToClipboard}
            >
              Copy to Clipboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PRGeneratorPage;
