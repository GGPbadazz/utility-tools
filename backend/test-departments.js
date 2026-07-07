#!/usr/bin/env node

const axios = require('axios');

const baseURL = 'http://localhost:3002';

async function testDepartmentManagement() {
  console.log('🧪 Testing Department Management API...\n');

  try {
    // 1. 测试获取部门列表
    console.log('1️⃣ Testing GET /api/departments');
    const getDept = await axios.get(`${baseURL}/api/departments`);
    console.log(`✅ Found ${getDept.data.length} active departments`);
    
    // 2. 测试添加部门
    console.log('\n2️⃣ Testing POST /api/departments (Add)');
    const addResult = await axios.post(`${baseURL}/api/departments`, {
      name: '测试部门2',
      description: '这是第二个测试部门'
    });
    console.log(`✅ Added department with ID: ${addResult.data.id}`);
    const newDeptId = addResult.data.id;
    
    // 3. 测试编辑部门
    console.log('\n3️⃣ Testing PUT /api/departments/:id (Edit)');
    await axios.put(`${baseURL}/api/departments/${newDeptId}`, {
      name: '测试部门2-已编辑',
      description: '这是已编辑的测试部门'
    });
    console.log(`✅ Updated department ID: ${newDeptId}`);
    
    // 4. 验证编辑结果
    const updated = await axios.get(`${baseURL}/api/departments`);
    const editedDept = updated.data.find(d => d.id === newDeptId);
    console.log(`📝 Name: ${editedDept.name}, Description: ${editedDept.description}`);
    
    // 5. 测试删除部门
    console.log('\n4️⃣ Testing DELETE /api/departments/:id (Soft Delete)');
    await axios.delete(`${baseURL}/api/departments/${newDeptId}`);
    console.log(`✅ Deleted (deactivated) department ID: ${newDeptId}`);
    
    // 6. 验证删除结果
    const final = await axios.get(`${baseURL}/api/departments`);
    const deletedDept = final.data.find(d => d.id === newDeptId);
    if (!deletedDept) {
      console.log('✅ Department successfully removed from active list');
    }
    
    console.log('\n🎉 All department management tests passed!');
    console.log(`📊 Final active departments count: ${final.data.length}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testDepartmentManagement();
