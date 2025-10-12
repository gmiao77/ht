
        const supabaseUrl = 'https://dpvqswmhxkvdsqayhklf.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdnFzd21oeGt2ZHNxYXloa2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Mjg3NjcsImV4cCI6MjA3MDEwNDc2N30.XZICsMMj63SCA86ZuNADz4xaoR2AfakSXttNzU0FxS0';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        // 管理员邮箱列表（与SQL函数中的权限配置一致）
        const ADMIN_EMAILS = ['24408139@qq.com']; // 替换为你的管理员邮箱

        // DOM 元素
        const adminLogin = document.getElementById('admin-login');
        const adminPanel = document.getElementById('admin-panel');
        const permissionDenied = document.getElementById('permission-denied');
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
        
        // 增加次数模态框元素
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

        // 初始化：页面加载时检查登录状态
        window.addEventListener('load', async () => {
            setupEventListeners();
            await checkAdminSession();
        });

        // 检查管理员登录状态
        async function checkAdminSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    showAdminLoginMessage('检查登录状态失败', 'error');
                    console.error('Session check error:', error);
                    showLoginPrompt();
                    return;
                }
                
                if (session) {
                    // 验证是否为管理员
                    const isAdmin = ADMIN_EMAILS.includes(session.user.email);
                    if (isAdmin) {
                        currentAdmin = session.user;
                        adminUserDisplay.textContent = `管理员: ${currentAdmin.email}`;
                        showAdminPanel();
                        await loadUserList(); // 调用自定义SQL函数加载用户
                        await calculateStatistics();
                    } else {
                        showPermissionDenied();
                    }
                } else {
                    showLoginPrompt();
                }
            } catch (err) {
                console.error('Error checking admin session:', err);
                showAdminLoginMessage('系统错误，请刷新页面重试', 'error');
                showLoginPrompt();
            }
        }

        // 显示登录界面
        function showLoginPrompt() {
            adminLogin.classList.remove('hidden');
            adminPanel.classList.add('hidden');
            permissionDenied.classList.add('hidden');
            document.body.style.overflow = '';
        }

        // 显示管理员面板
        function showAdminPanel() {
            adminLogin.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            permissionDenied.classList.add('hidden');
            document.body.style.overflow = '';
        }

        // 显示权限不足提示
        function showPermissionDenied() {
            adminLogin.classList.add('hidden');
            adminPanel.classList.add('hidden');
            permissionDenied.classList.remove('hidden');
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
            
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    showAdminLoginMessage(error.message, 'error');
                    console.error('Admin login error:', error);
                    return;
                }
                
                // 验证是否为管理员
                const isAdmin = ADMIN_EMAILS.includes(data.session.user.email);
                if (isAdmin) {
                    currentAdmin = data.session.user;
                    adminUserDisplay.textContent = `管理员: ${currentAdmin.email}`;
                    showAdminPanel();
                    await loadUserList();
                    await calculateStatistics();
                    showAdminLoginMessage('登录成功', 'success');
                    
                    // 清空输入框
                    adminEmailInput.value = '';
                    adminPasswordInput.value = '';
                } else {
                    // 非管理员，强制登出
                    await supabase.auth.signOut();
                    showAdminLoginMessage('您没有管理员权限', 'error');
                    showPermissionDenied();
                }
            } catch (err) {
                console.error('Login process error:', err);
                showAdminLoginMessage('登录失败，请重试', 'error');
            }
        }

        // 管理员登出
        async function adminLogoutHandler() {
            try {
                const { error } = await supabase.auth.signOut();
                
                if (error) {
                    console.error('Logout error:', error);
                    return;
                }
                
                currentAdmin = null;
                showLoginPrompt();
            } catch (err) {
                console.error('Error during logout:', err);
            }
        }

        // 加载用户列表：调用自定义SQL函数（核心修改）
        async function loadUserList() {
            // 清空表格并显示加载状态
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-10 text-center text-gray-500">
                        <i class="fa fa-spinner fa-spin mr-2"></i>加载用户数据中...
                    </td>
                </tr>
            `;
            
            try {
                // 关键：调用自定义SQL函数get_all_users获取用户数据
                const { data, error } = await supabase.rpc('get_all_users');
                
                if (error) {
                    throw error;
                }
                
                // 处理用户数据（与SQL函数返回字段对应）
                allUsers = data.map(user => ({
                    id: user.user_id, // 对应SQL函数的user_id字段
                    email: user.email,
                    name: user.user_metadata?.name || '未设置', // 从user_metadata获取用户名
                    created_at: new Date(user.created_at),
                    last_sign_in_at: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null,
                    remaining_uses: user.remaining_uses, // 从SQL函数直接获取剩余次数
                    total_uses: user.total_uses // 从SQL函数直接获取总次数
                }));
                
                // 按注册时间排序（最新在前）
                allUsers.sort((a, b) => b.created_at - a.created_at);
                
                // 渲染用户表格
                renderUsersTable(allUsers);
            } catch (error) {
                console.error('Error loading user data:', error);
                // 错误分类提示
                let errorMsg = '加载用户数据失败';
                if (error.code === '42501') { // 权限不足错误码
                    errorMsg += '（权限不足，请检查管理员身份或SQL函数权限配置）';
                } else if (error.code === '42883') { // 函数不存在错误码
                    errorMsg += '（未找到get_all_users函数，请先创建自定义SQL函数）';
                }
                
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-10 text-center text-red-500">
                            <i class="fa fa-exclamation-circle mr-2"></i>${errorMsg}
                            <p class="mt-1 text-xs">${error.message || ''}</p>
                        </td>
                    </tr>
                `;
            }
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
                const formattedCreateTime = user.created_at.toLocaleString();
                const formattedLastLogin = user.last_sign_in_at 
                    ? user.last_sign_in_at.toLocaleString() 
                    : '未登录';
                
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${user.id.substring(0, 8)}...
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        ${user.email || '未知邮箱'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        ${user.name}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${formattedCreateTime}
                        <div class="text-xs text-gray-400 mt-1">最后登录: ${formattedLastLogin}</div>
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
                        <button class="text-primary hover:text-primary/80 add-uses-btn transition-colors" 
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
            try {
                // 总用户数
                totalUsersDisplay.textContent = allUsers.length;
                
                // 总生成次数和剩余总次数（从用户数据汇总）
                const stats = allUsers.reduce((acc, user) => {
                    acc.totalGenerations += user.total_uses;
                    acc.totalRemaining += user.remaining_uses;
                    return acc;
                }, { totalGenerations: 0, totalRemaining: 0 });
                
                totalGenerationsDisplay.textContent = stats.totalGenerations;
                totalRemainingDisplay.textContent = stats.totalRemaining;
            } catch (error) {
                console.error('Error calculating statistics:', error);
            }
        }

        // 打开增加次数模态框
        function openAddUsesModal(userId, userEmail) {
            targetUserIdInput.value = userId;
            userEmailDisplay.value = userEmail;
            addUsesCountInput.value = 10; // 默认增加10次
            addUsesMessage.classList.add('hidden');
            
            // 显示模态框并添加动画
            addUsesModal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            setTimeout(() => {
                addUsesModal.classList.add('opacity-100', 'pointer-events-auto');
                addUsesModal.querySelector('div').classList.remove('scale-95');
                addUsesModal.querySelector('div').classList.add('scale-100');
            }, 10);
            
            document.body.style.overflow = 'hidden';
            addUsesCountInput.focus();
        }

        // 关闭增加次数模态框
        function closeAddUsesModal() {
            // 隐藏模态框并添加动画
            addUsesModal.classList.remove('opacity-100', 'pointer-events-auto');
            addUsesModal.classList.add('opacity-0', 'pointer-events-none');
            addUsesModal.querySelector('div').classList.remove('scale-100');
            addUsesModal.querySelector('div').classList.add('scale-95');
            
            setTimeout(() => {
                addUsesModal.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        }

        // 确认增加次数
        async function confirmAddUses() {
            const userId = targetUserIdInput.value;
            const count = parseInt(addUsesCountInput.value, 10);
            
            if (!userId || isNaN(count) || count < 1) {
                showAddUsesMessage('请输入有效的次数', 'error');
                return;
            }
            
            showAddUsesMessage('正在更新次数...', 'info');
            
            try {
                // 获取当前用户的使用数据
                const { data: userUsage, error: fetchError } = await supabase
                    .from('user_usage')
                    .select('remaining_uses, total_uses')
                    .eq('user_id', userId)
                    .single();
                    
                if (fetchError) {
                    throw fetchError;
                }
                
                // 计算新的剩余次数和总次数
                const newRemaining = userUsage.remaining_uses + count;
                const newTotal = userUsage.total_uses + count;
                
                // 更新用户次数
                const { error: updateError } = await supabase
                    .from('user_usage')
                    .update({ 
                        remaining_uses: newRemaining,
                        total_uses: newTotal,
                        updated_at: new Date()
                    })
                    .eq('user_id', userId);
                    
                if (updateError) {
                    throw updateError;
                }
                
                // 更新成功
                showAddUsesMessage(`成功增加 ${count} 次使用次数`, 'success');
                
                // 更新本地数据
                const userIndex = allUsers.findIndex(u => u.id === userId);
                if (userIndex !== -1) {
                    allUsers[userIndex].remaining_uses = newRemaining;
                    allUsers[userIndex].total_uses = newTotal;
                }
                
                // 重新渲染表格和统计数据
                renderUsersTable(allUsers);
                calculateStatistics();
                
                // 1.5秒后关闭模态框
                setTimeout(closeAddUsesModal, 1500);
            } catch (error) {
                console.error('Error adding uses:', error);
                showAddUsesMessage('更新失败: ' + (error.message || '请重试'), 'error');
            }
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

        // 设置事件监听器
        function setupEventListeners() {
            // 管理员登录
            adminLoginBtn.addEventListener('click', adminLoginHandler);
            
            // 支持按Enter键登录
            adminPasswordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    adminLoginHandler();
                }
            });
            
            // 管理员登出
            logoutBtn.addEventListener('click', adminLogoutHandler);
            
            // 用户搜索
            userSearchInput.addEventListener('input', searchUsers);
            
            // 增加次数模态框事件
            closeAddUses.addEventListener('click', closeAddUsesModal);
            cancelAddUses.addEventListener('click', closeAddUsesModal);
            confirmAddUsesBtn.addEventListener('click', confirmAddUses);
            
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
            
            // 支持按Enter键确认增加次数
            addUsesCountInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    confirmAddUses();
                }
            });
        }
