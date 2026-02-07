import React, { useState } from 'react';
import {
  Collapse,
  Table,
  Button,
  Tooltip,
  Input,
  Space,
  Tag,
  Form,
  Modal,
  ColorPicker,
  Badge,
  List,
  Checkbox,
  Divider,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  WarningOutlined,
  UndoOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import type { SkillCategory, Subcategory, LabMember } from '../../types/types';
import type { ColumnsType } from 'antd/es/table';

// Type for pending changes
interface PendingChange {
  id: string;
  type:
    | 'add-skill'
    | 'update-skill'
    | 'delete-skill'
    | 'add-category'
    | 'update-category'
    | 'delete-category';
  data: any;
  description: string;
}

interface SkillCategoryAdminProps {
  categories: SkillCategory[];
  skills: Subcategory[];
  members: LabMember[];
  onGenerateBatchPR: (changes: PendingChange[]) => void;
}

export const SkillCategoryAdmin: React.FC<SkillCategoryAdminProps> = ({
  categories,
  skills,
  members,
  onGenerateBatchPR,
}) => {
  // Pending changes state
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  // Category Form State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SkillCategory | null>(
    null,
  );
  const [categoryForm] = Form.useForm();

  // Skill Form State
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Subcategory | null>(null);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillForm] = Form.useForm();

  // Add a pending change (prevents duplicates)
  const addPendingChange = (change: Omit<PendingChange, 'id'>) => {
    setPendingChanges((prev) => {
      // Check if a change with same type and data.id already exists
      const existingIndex = prev.findIndex(
        (c) => c.type === change.type && c.data.id === change.data.id,
      );

      if (existingIndex >= 0) {
        // Replace existing change with updated one
        const updated = [...prev];
        updated[existingIndex] = {
          ...change,
          id: prev[existingIndex].id,
        };
        return updated;
      }

      // Add new change
      const id = `change-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return [...prev, { ...change, id }];
    });
  };

  // Remove a pending change
  const removePendingChange = (id: string) => {
    setPendingChanges((prev) => prev.filter((c) => c.id !== id));
  };

  // Clear all pending changes
  const clearPendingChanges = () => {
    setPendingChanges([]);
  };

  // Check if skill is used by any member
  const isSkillInUse = (skillId: string): boolean => {
    return members.some((m) => m.skills.some((s) => s.skillId === skillId));
  };

  // Check if category is used by any skill
  const isCategoryInUse = (categoryId: string): boolean => {
    return skills.some((s) => s.belongsTo.includes(categoryId));
  };

  // Get members using a skill
  const getMembersUsingSkill = (skillId: string): string[] => {
    return members
      .filter((m) => m.skills.some((s) => s.skillId === skillId))
      .map((m) => m.name);
  };

  // Get skills using a category
  const getSkillsUsingCategory = (categoryId: string): string[] => {
    return skills
      .filter((s) => s.belongsTo.includes(categoryId))
      .map((s) => s.name);
  };

  // Skills Table Columns
  const skillColumns: ColumnsType<Subcategory> = [
    {
      title: 'Skill Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span className='text-white'>{name}</span>,
    },
    {
      title: 'Categories',
      dataIndex: 'belongsTo',
      key: 'belongsTo',
      render: (belongsTo: string[]) => (
        <Space wrap>
          {belongsTo.map((catId) => {
            const cat = categories.find((c) => c.id === catId);
            return cat ? (
              <Tag
                key={catId}
                style={{
                  backgroundColor: `${cat.color}20`,
                  color: cat.color,
                  border: `1px solid ${cat.color}`,
                }}
              >
                {cat.name}
              </Tag>
            ) : null;
          })}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: Subcategory) => {
        const inUse = isSkillInUse(record.id);
        const usedBy = getMembersUsingSkill(record.id);

        return (
          <Space>
            <Tooltip title='Edit Skill'>
              <Button
                size='small'
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingSkill(record);
                  setIsAddingSkill(false);
                  skillForm.setFieldsValue({
                    name: record.name,
                    description: record.description,
                    belongsTo: record.belongsTo,
                  });
                  setSkillModalOpen(true);
                }}
              />
            </Tooltip>
            <Tooltip
              title={
                inUse
                  ? `Cannot delete: Used by ${usedBy.join(', ')}`
                  : 'Delete Skill'
              }
            >
              <Button
                size='small'
                danger
                icon={inUse ? <WarningOutlined /> : <DeleteOutlined />}
                disabled={inUse}
                onClick={() => {
                  addPendingChange({
                    type: 'delete-skill',
                    data: record,
                    description: `Delete skill "${record.name}"`,
                  });
                }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  // Categories Table Columns
  const categoryColumns: ColumnsType<SkillCategory> = [
    {
      title: 'Category Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: SkillCategory) => (
        <span style={{ color: record.color }}>{name}</span>
      ),
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      width: 80,
      render: (color: string) => (
        <div className='w-6 h-6 rounded' style={{ backgroundColor: color }} />
      ),
    },
    {
      title: 'Skills Count',
      key: 'skillsCount',
      width: 100,
      render: (_: any, record: SkillCategory) => {
        const count = skills.filter((s) =>
          s.belongsTo.includes(record.id),
        ).length;
        return <span className='text-gray-400'>{count}</span>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: SkillCategory) => {
        const inUse = isCategoryInUse(record.id);
        const usedBy = getSkillsUsingCategory(record.id);

        return (
          <Space>
            <Tooltip title='Edit Category'>
              <Button
                size='small'
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingCategory(record);
                  categoryForm.setFieldsValue({
                    name: record.name,
                    description: record.description,
                    color: record.color,
                  });
                  setCategoryModalOpen(true);
                }}
              />
            </Tooltip>
            <Tooltip
              title={
                inUse
                  ? `Cannot delete: Used by ${usedBy.slice(0, 3).join(', ')}${usedBy.length > 3 ? '...' : ''}`
                  : 'Delete Category'
              }
            >
              <Button
                size='small'
                danger
                icon={inUse ? <WarningOutlined /> : <DeleteOutlined />}
                disabled={inUse}
                onClick={() => {
                  addPendingChange({
                    type: 'delete-category',
                    data: record,
                    description: `Delete category "${record.name}"`,
                  });
                }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const handleCategorySubmit = () => {
    categoryForm.validateFields().then((values) => {
      const colorValue =
        typeof values.color === 'string'
          ? values.color
          : values.color?.toHexString?.() || '#000000';

      if (editingCategory) {
        const changes: string[] = [];
        if (editingCategory.name !== values.name) {
          changes.push(`name: "${editingCategory.name}" → "${values.name}"`);
        }
        if (editingCategory.description !== values.description) {
          changes.push('description');
        }
        if (editingCategory.color !== colorValue) {
          changes.push(`color: ${editingCategory.color} → ${colorValue}`);
        }
        const changeDesc = changes.length > 0 ? ` (${changes.join(', ')})` : '';

        addPendingChange({
          type: 'update-category',
          data: {
            ...editingCategory,
            ...values,
            color: colorValue,
          },
          description: `Update category "${values.name}"${changeDesc}`,
        });
      } else {
        addPendingChange({
          type: 'add-category',
          data: {
            id: values.name.toLowerCase().replace(/\s+/g, '-'),
            ...values,
            color: colorValue,
          },
          description: `Add new category "${values.name}"`,
        });
      }
      setCategoryModalOpen(false);
      categoryForm.resetFields();
      setEditingCategory(null);
    });
  };

  const handleSkillSubmit = () => {
    skillForm.validateFields().then((values) => {
      if (isAddingSkill) {
        const skillId = values.name.toLowerCase().replace(/\s+/g, '-');
        addPendingChange({
          type: 'add-skill',
          data: {
            id: skillId,
            name: values.name,
            description: values.description || `Description for ${values.name}`,
            belongsTo: values.belongsTo || [],
          },
          description: `Add new skill "${values.name}"`,
        });
      } else if (editingSkill) {
        const changes: string[] = [];
        if (editingSkill.name !== values.name) {
          changes.push(`name: "${editingSkill.name}" → "${values.name}"`);
        }
        if (editingSkill.description !== values.description) {
          changes.push('description');
        }
        const oldCategories = editingSkill.belongsTo;
        const newCategories = values.belongsTo || [];
        const added = newCategories.filter(
          (id: string) => !oldCategories.includes(id),
        );
        const removed = oldCategories.filter(
          (id: string) => !newCategories.includes(id),
        );

        if (added.length > 0 || removed.length > 0) {
          const categoryChanges: string[] = [];
          if (added.length > 0) {
            const addedNames = added.map(
              (id: string) => categories.find((c) => c.id === id)?.name || id,
            );
            categoryChanges.push(`+${addedNames.join(', ')}`);
          }
          if (removed.length > 0) {
            const removedNames = removed.map(
              (id: string) => categories.find((c) => c.id === id)?.name || id,
            );
            categoryChanges.push(`-${removedNames.join(', ')}`);
          }
          changes.push(`categories: ${categoryChanges.join(', ')}`);
        }
        const changeDesc = changes.length > 0 ? ` (${changes.join('; ')})` : '';

        addPendingChange({
          type: 'update-skill',
          data: {
            ...editingSkill,
            ...values,
          },
          description: `Update skill "${values.name}"${changeDesc}`,
        });
      }
      setSkillModalOpen(false);
      skillForm.resetFields();
      setEditingSkill(null);
      setIsAddingSkill(false);
    });
  };

  // Validate pending changes for conflicts
  const validatePendingChanges = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Get IDs of categories being deleted
    const deletedCategoryIds = pendingChanges
      .filter((c) => c.type === 'delete-category')
      .map((c) => c.data.id);

    // Get IDs of skills being deleted
    const deletedSkillIds = pendingChanges
      .filter((c) => c.type === 'delete-skill')
      .map((c) => c.data.id);

    // Check if any added/updated skill references a deleted category
    for (const change of pendingChanges) {
      if (change.type === 'add-skill' || change.type === 'update-skill') {
        const skillCategories: string[] = change.data.belongsTo || [];
        for (const catId of skillCategories) {
          if (deletedCategoryIds.includes(catId)) {
            const catName =
              categories.find((c) => c.id === catId)?.name || catId;
            errors.push(
              `Skill "${change.data.name}" references category "${catName}" which is being deleted`,
            );
          }
        }
      }
    }

    // Check if any updated category is also being deleted
    for (const change of pendingChanges) {
      if (change.type === 'update-category') {
        if (deletedCategoryIds.includes(change.data.id)) {
          errors.push(
            `Category "${change.data.name}" is both being updated and deleted`,
          );
        }
      }
      if (change.type === 'update-skill') {
        if (deletedSkillIds.includes(change.data.id)) {
          errors.push(
            `Skill "${change.data.name}" is both being updated and deleted`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  };

  const handleGeneratePR = () => {
    if (pendingChanges.length === 0) return;

    const validation = validatePendingChanges();
    if (!validation.valid) {
      Modal.error({
        title: 'Invalid Changes Detected',
        content: (
          <ul className='list-disc pl-4'>
            {validation.errors.map((err, i) => (
              <li key={i} className='text-red-400'>
                {err}
              </li>
            ))}
          </ul>
        ),
      });
      return;
    }

    onGenerateBatchPR(pendingChanges);
  };

  return (
    <>
      <Collapse
        className='glass-card !bg-white/5'
        items={[
          {
            key: 'admin',
            label: (
              <Space>
                <span className='text-white font-semibold'>
                  Skill & Category Administration
                </span>
                {pendingChanges.length > 0 && (
                  <Badge
                    count={pendingChanges.length}
                    style={{ backgroundColor: '#52c41a' }}
                  />
                )}
              </Space>
            ),
            children: (
              <div className='space-y-6'>
                {/* Pending Changes Section */}
                {pendingChanges.length > 0 && (
                  <div className='bg-green-500/10 border border-green-500/30 rounded-lg p-4'>
                    <div className='flex justify-between items-center mb-3'>
                      <h3 className='text-green-400 font-medium'>
                        Pending Changes ({pendingChanges.length})
                      </h3>
                      <Space>
                        <Button
                          size='small'
                          icon={<UndoOutlined />}
                          onClick={clearPendingChanges}
                        >
                          Clear All
                        </Button>
                        <Button
                          type='primary'
                          size='small'
                          icon={<GithubOutlined />}
                          onClick={handleGeneratePR}
                        >
                          Generate PR
                        </Button>
                      </Space>
                    </div>
                    <List
                      size='small'
                      dataSource={pendingChanges}
                      renderItem={(item) => (
                        <List.Item
                          className='!border-green-500/20'
                          actions={[
                            <Button
                              key='remove'
                              type='text'
                              size='small'
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => removePendingChange(item.id)}
                            />,
                          ]}
                        >
                          <Tag
                            color={
                              item.type.includes('add')
                                ? 'green'
                                : item.type.includes('delete')
                                  ? 'red'
                                  : 'blue'
                            }
                          >
                            {item.type.replace('-', ' ').toUpperCase()}
                          </Tag>
                          <span className='text-gray-300'>
                            {item.description}
                          </span>
                        </List.Item>
                      )}
                    />
                  </div>
                )}

                {/* Skills Section */}
                <div>
                  <div className='flex justify-between items-center mb-3'>
                    <h3 className='text-white font-medium'>Skills</h3>
                    <Button
                      size='small'
                      type='primary'
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingSkill(null);
                        setIsAddingSkill(true);
                        skillForm.resetFields();
                        setSkillModalOpen(true);
                      }}
                    >
                      Add Skill
                    </Button>
                  </div>
                  <Table
                    dataSource={skills}
                    columns={skillColumns}
                    rowKey='id'
                    size='small'
                    pagination={{ pageSize: 5 }}
                    className='admin-table'
                  />
                </div>

                <Divider className='!border-gray-700' />

                {/* Categories Section */}
                <div>
                  <div className='flex justify-between items-center mb-3'>
                    <h3 className='text-white font-medium'>Categories</h3>
                    <Button
                      size='small'
                      type='primary'
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingCategory(null);
                        categoryForm.resetFields();
                        setCategoryModalOpen(true);
                      }}
                    >
                      Add Category
                    </Button>
                  </div>
                  <Table
                    dataSource={categories}
                    columns={categoryColumns}
                    rowKey='id'
                    size='small'
                    pagination={false}
                    className='admin-table'
                  />
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Category Modal */}
      <Modal
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
        open={categoryModalOpen}
        onCancel={() => {
          setCategoryModalOpen(false);
          categoryForm.resetFields();
          setEditingCategory(null);
        }}
        onOk={handleCategorySubmit}
        okText='Add to Changes'
      >
        <Form form={categoryForm} layout='vertical'>
          <Form.Item
            name='name'
            label='Category Name'
            rules={[{ required: true, message: 'Please enter category name' }]}
          >
            <Input placeholder='e.g., Machine Learning' />
          </Form.Item>
          <Form.Item name='description' label='Description'>
            <Input.TextArea placeholder='Brief description of the category' />
          </Form.Item>
          <Form.Item
            name='color'
            label='Color'
            rules={[{ required: true, message: 'Please select a color' }]}
          >
            <ColorPicker showText />
          </Form.Item>
        </Form>
      </Modal>

      {/* Skill Add/Edit Modal */}
      <Modal
        title={isAddingSkill ? 'Add New Skill' : 'Edit Skill'}
        open={skillModalOpen}
        onCancel={() => {
          setSkillModalOpen(false);
          skillForm.resetFields();
          setEditingSkill(null);
          setIsAddingSkill(false);
        }}
        onOk={handleSkillSubmit}
        okText='Add to Changes'
      >
        <Form form={skillForm} layout='vertical'>
          <Form.Item
            name='name'
            label='Skill Name'
            rules={[{ required: true, message: 'Please enter skill name' }]}
          >
            <Input placeholder='e.g., Computer Vision' />
          </Form.Item>
          <Form.Item name='description' label='Description'>
            <Input.TextArea placeholder='Brief description of the skill' />
          </Form.Item>
          <Form.Item
            name='belongsTo'
            label='Categories (select multiple for overlap)'
            rules={[
              { required: true, message: 'Select at least one category' },
            ]}
          >
            <Checkbox.Group>
              <Space wrap>
                {categories.map((cat) => (
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
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SkillCategoryAdmin;
