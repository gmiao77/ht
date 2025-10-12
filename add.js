
        const supabaseUrl = 'https://dpvqswmhxkvdsqayhklf.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdnFzd21oeGt2ZHNxYXloa2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Mjg3NjcsImV4cCI6MjA3MDEwNDc2N30.XZICsMMj63SCA86ZuNADz4xaoR2AfakSXttNzU0FxS0';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        // 管理员邮箱列表 - 只有这些邮箱可以登录管理后台
        const ADMIN_EMAILS = ['24408139@qq.com']; // 替换为你的管理员邮箱

        // DOM 元素
        const adminLogin = document.getElementById('admin-login');
        const adminPanel = document.getElementById('admin-panel');
        const adminLoginBtn = document.getElementById('admin-login-btn');
        const adminLoginMessage = document.getElementById('admin-login-message');
        const adminEmailInput = document.getElementById('admin-email');
        const adminPasswordInput = document.getElementById('admin-password');
        const adminUserDisplay = document.getElementById('admin-user');
        const logoutBtn = document.getElementById('logout-btn');
        const usersTableBody = document.getElementById('users-table-body');
        const userSearchInput = document.getElementById('user-search');
        const totalUsersDisplay = document.getElementById('total-users');
        const totalGenerationsDisplay = document.getElementById('total-generations');
        const totalRemainingDisplay = document.getElementById('total-remaining');
        
        // 增加次数模态框元素（注意：这里变量名是confirmAddUsesBtn，与函数名区分）
        const addUsesModal = document.getElementById('add-uses-modal');
        const closeAddUses = document.getElementById('close-add-uses');
        const cancelAddUses = document.getElementById('cancel-add-uses');
        const confirmAddUsesBtn = document.getElementById('confirm-add-uses'); 
        const targetUserIdInput = document.getElementById('target-user-id');
        const userEmailDisplay = document.getElementById('user-email-display');
        const addUsesCountInput = document.getElementById('add-uses-count');
        const addUsesMessage = document.getElementById('add-uses-message');

        // 全局变量
        let currentAdmin = null;
        let allUsers = [];

        // 初始化
        async function initAdminPanel() {
            setupEventListeners();
            await checkAdminSession();
        }

        // 检查管理员登录状态
        async function checkAdminSession() {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                showAdminLoginMessage('检查登录状态失败', 'error');
                console.error(error);
                return;
            }
            
            if (session) {
                // 检查是否为管理员邮箱
                if (ADMIN_EMAILS.includes(session.user.email)) {
                    currentAdmin = session.user;
                    showAdminPanel();
                    await loadUsersData();
                    await calculateStatistics();
                } else {
                    // 不是管理员，强制登出
                    await supabase.auth.signOut();
                    showAdminLoginMessage('您没有管理员权限', 'error');
                }
            } else {
                // 未登录，显示登录界面
                showAdminLogin();
            }
        }

        // 显示管理员登录界面
        function showAdminLogin() {
            adminLogin.classList.remove('hidden');
            adminPanel.classList.add('hidden');
        }

        // 显示管理员面板
        function showAdminPanel() {
            adminLogin.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            adminUserDisplay.textContent = `管理员: ${currentAdmin.email}`;
        }

        // 管理员登录
        async function adminLoginHandler() {
            const email = adminEmailInput.value.trim();
            const password = adminPasswordInput.value.trim();
            
            if (!email || !password) {
                showAdminLoginMessage('请输入邮箱和密码', 'error');
                return;
            }
            
            showAdminLoginMessage('登录中...', 'info');
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                showAdminLoginMessage(error.message, 'error');
                console.error('管理员登录失败:', error);
                return;
            }
            
            // 检查是否为管理员
            if (ADMIN_EMAILS.includes(data.user.email)) {
                currentAdmin = data.user;
                showAdminPanel();
                await loadUsersData();
                await calculateStatistics();
                showAdminLoginMessage('登录成功', 'success');
            } else {
                // 不是管理员，登出并提示
                await supabase.auth.signOut();
                showAdminLoginMessage('您没有管理员权限', 'error');
            }
        }

        // 管理员登出
        async function adminLogoutHandler() {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('登出失败:', error);
                return;
            }
            
            currentAdmin = null;
            showAdminLogin();
        }

        // 加载用户数据
        async function loadUsersData() {
            // 清空表格
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-10 text-center text-gray-500">
                        <i class="fa fa-spinner fa-spin mr-2"></i>加载用户数据中...
                    </td>
                </tr>
            `;
            
            // 获取所有用户
            const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
            
            if (usersError) {
                console.error('获取用户列表失败:', usersError);
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-10 text-center text-red-500">
                            <i class="fa fa-exclamation-circle mr-2"></i>加载用户数据失败
                        </td>
                    </tr>
                `;
                return;
            }
            
            // 获取用户使用数据
            const { data: usageData, error: usageError } = await supabase
                .from('user_usage')
                .select('user_id, remaining_uses, total_uses');
                
            if (usageError) {
                console.error('获取用户使用数据失败:', usageError);
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-10 text-center text-red-500">
                            <i class="fa fa-exclamation-circle mr-2"></i>加载用户使用数据失败
                        </td>
                    </tr>
                `;
                return;
            }
            
            // 处理用户数据
            allUsers = users.users.map(user => {
                const usage = usageData.find(u => u.user_id === user.id) || {
                    remaining_uses: 0,
                    total_uses: 0
                };
                
                return {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.name || '未设置',
                    created_at: new Date(user.created_at),
                    remaining_uses: usage.remaining_uses,
                    total_uses: usage.total_uses
                };
            });
            
            // 按注册时间排序（最新的在前）
            allUsers.sort((a, b) => b.created_at - a.created_at);
            
            // 显示用户数据
            renderUsersTable(allUsers);
        }

        // 渲染用户表格
        function renderUsersTable(users) {
            if (users.length === 0) {
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-10 text-center text-gray-500">
                            <i class="fa fa-folder-open-o mr-2"></i>暂无用户数据
                        </td>
                    </tr>
                `;
                return;
            }
            
            usersTableBody.innerHTML = '';
            
            users.forEach(user => {
                const row = document.createElement('tr');
                row.className = 'user-row';
                
                // 格式化日期
                const formattedDate = user.created_at.toLocaleString();
                
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${user.id.substring(0, 8)}...
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        ${user.email}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        ${user.name}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${formattedDate}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        ${user.total_uses}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            ${user.remaining_uses}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-primary hover:text-primary/80 add-uses-btn" 
                                data-user-id="${user.id}" 
                                data-user-email="${user.email}">
                            增加次数
                        </button>
                    </td>
                `;
                
                usersTableBody.appendChild(row);
            });
            
            // 为增加次数按钮添加事件
            document.querySelectorAll('.add-uses-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const userId = btn.getAttribute('data-user-id');
                    const userEmail = btn.getAttribute('data-user-email');
                    openAddUsesModal(userId, userEmail);
                });
            });
        }

        // 计算统计数据
        async function calculateStatistics() {
            // 总用户数
            totalUsersDisplay.textContent = allUsers.length;
            
            // 总生成次数和剩余总次数
            const stats = allUsers.reduce((acc, user) => {
                acc.totalGenerations += user.total_uses;
                acc.totalRemaining += user.remaining_uses;
                return acc;
            }, { totalGenerations: 0, totalRemaining: 0 });
            
            totalGenerationsDisplay.textContent = stats.totalGenerations;
            totalRemainingDisplay.textContent = stats.totalRemaining;
        }

        // 打开增加次数模态框
        function openAddUsesModal(userId, userEmail) {
            targetUserIdInput.value = userId;
            userEmailDisplay.value = userEmail;
            addUsesCountInput.value = 10; // 默认增加10次
            addUsesMessage.classList.add('hidden');
            addUsesModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        // 关闭增加次数模态框
        function closeAddUsesModal() {
            addUsesModal.classList.add('hidden');
            document.body.style.overflow = '';
        }

        // 确认增加次数（修复2：函数名改为confirmAddUsesHandler，避免与DOM变量冲突）
        async function confirmAddUsesHandler() {
            const userId = targetUserIdInput.value;
            const count = parseInt(addUsesCountInput.value, 10);
            
            if (!userId || isNaN(count) || count < 1) {
                showAddUsesMessage('请输入有效的次数', 'error');
                return;
            }
            
            showAddUsesMessage('正在更新次数...', 'info');
            
            // 获取当前用户的使用数据
            const { data: userUsage, error: fetchError } = await supabase
                .from('user_usage')
                .select('remaining_uses')
                .eq('user_id', userId)
                .single();
                
            if (fetchError) {
                console.error('获取用户使用数据失败:', fetchError);
                showAddUsesMessage('更新失败，请重试', 'error');
                return;
            }
            
            // 计算新的剩余次数
            const newRemaining = userUsage.remaining_uses + count;
            
            // 更新用户次数
            const { error: updateError } = await supabase
                .from('user_usage')
                .update({ 
                    remaining_uses: newRemaining,
                    updated_at: new Date()
                })
                .eq('user_id', userId);
                
            if (updateError) {
                console.error('更新用户次数失败:', updateError);
                showAddUsesMessage('更新失败，请重试', 'error');
                return;
            }
            
            // 更新成功
            showAddUsesMessage(`成功增加 ${count} 次使用次数`, 'success');
            
            // 更新本地数据
            const userIndex = allUsers.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                allUsers[userIndex].remaining_uses = newRemaining;
            }
            
            // 重新渲染表格和统计数据
            renderUsersTable(allUsers);
            calculateStatistics();
            
            // 3秒后关闭模态框
            setTimeout(closeAddUsesModal, 1500);
        }

        // 用户搜索
        function searchUsers() {
            const searchTerm = userSearchInput.value.toLowerCase().trim();
            
            if (!searchTerm) {
                renderUsersTable(allUsers);
                return;
            }
            
            const filteredUsers = allUsers.filter(user => 
                user.email.toLowerCase().includes(searchTerm) || 
                user.name.toLowerCase().includes(searchTerm)
            );
            
            renderUsersTable(filteredUsers);
        }

        // 显示管理员登录消息
        function showAdminLoginMessage(text, type = 'info') {
            adminLoginMessage.textContent = text;
            adminLoginMessage.classList.remove('hidden', 'text-green-600', 'text-red-600', 'text-blue-600');
            
            if (type === 'success') {
                adminLoginMessage.classList.add('text-green-600');
            } else if (type === 'error') {
                adminLoginMessage.classList.add('text-red-600');
            } else {
                adminLoginMessage.classList.add('text-blue-600');
            }
        }

        // 显示增加次数消息
        function showAddUsesMessage(text, type = 'info') {
            addUsesMessage.textContent = text;
            addUsesMessage.classList.remove('hidden', 'text-green-600', 'text-red-600', 'text-blue-600');
            
            if (type === 'success') {
                addUsesMessage.classList.add('text-green-600');
            } else if (type === 'error') {
                addUsesMessage.classList.add('text-red-600');
            } else {
                addUsesMessage.classList.add('text-blue-600');
            }
        }

        // 设置事件监听器（修复3：绑定事件时使用新的函数名confirmAddUsesHandler）
        function setupEventListeners() {
            // 管理员登录
            adminLoginBtn.addEventListener('click', adminLoginHandler);
            
            // 管理员登出
            logoutBtn.addEventListener('click', adminLogoutHandler);
            
            // 用户搜索
            userSearchInput.addEventListener('input', searchUsers);
            
            // 增加次数模态框
            closeAddUses.addEventListener('click', closeAddUsesModal);
            cancelAddUses.addEventListener('click', closeAddUsesModal);
            confirmAddUsesBtn.addEventListener('click', confirmAddUsesHandler); // 绑定新函数名
            
            // 点击模态框背景关闭
            addUsesModal.addEventListener('click', (e) => {
                if (e.target === addUsesModal) {
                    closeAddUsesModal();
                }
            });
            
            // 按ESC键关闭模态框
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !addUsesModal.classList.contains('hidden')) {
                    closeAddUsesModal();
                }
            });
        }

        // 初始化管理后台
        document.addEventListener('DOMContentLoaded', initAdminPanel);
