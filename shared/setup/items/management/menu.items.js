module.exports = {
    name: "menu",
    items: [
        {
            ordernumber: 1,
            items: [
                {
                    ordernumber: 1,
                    key: "MenuManagement",
                    type: "component",
                    isactive: true,
                    id: "system1563442228155",
                    url: "",
                    icon: '<i class="fab fa-elementor"></i>',
                    title: {
                        "vi-VN": "Menu",
                        "en-US": "Menu",
                    },
                },
                {
                    ordernumber: 2,
                    key: "UserManagement",
                    type: "component",
                    isactive: true,
                    id: "phanvanbaoan1592899386970",
                    icon: '<i class="fas fa-user"></i>',
                    title: {
                        "vi-VN": "Tài khoản",
                        "en-US": "User",
                    },
                    url: "",
                },
                {
                    ordernumber: 3,
                    key: "GroupManagement",
                    type: "component",
                    isactive: true,
                    id: "phanvanbaoan1592899395783",
                    icon: '<i class="fas fa-users"></i>',
                    title: {
                        "vi-VN": "Nhóm tài khoản",
                        "en-US": "Group",
                    },
                    url: "",
                },
                {
                    ordernumber: 5,
                    key: "OrganizationManagement",
                    type: "component",
                    isactive: true,
                    id: "phanvanbaoan1592900128183",
                    icon: '<i class="fa fa-building"></i>',
                    title: {
                        "vi-VN": "Phòng ban",
                        "en-US": "Department",
                    },
                    url: "",
                },
                {
                    ordernumber: 7,
                    icon: '<i class="fas fa-wrench"></i>',
                    title: {
                        "vi-VN": "Cấu hình/ Cài đặt",
                        "en-US": "Setting",
                    },
                    key: "Setting",
                    type: "component",
                    isactive: true,
                    id: "system1594130674331",
                },
                {
                    ordernumber: 8,
                    icon: '<i class="fas fa-clipboard-list"></i>',
                    title: {
                        "vi-VN": "Danh sách danh mục",
                        "en-US": "Directory List",
                    },
                    key: "MasterDirectory",
                    type: "component",
                    isactive: true,
                    id: "system1594130674332",
                },
                {
                    ordernumber: 9,
                    icon: '<i class="far fa-clipboard"></i>',
                    title: {
                        "vi-VN": "Danh mục",
                        "en-US": "Directory",
                    },
                    key: "Directory",
                    type: "component",
                    isactive: true,
                    id: "system1594130674333",
                },
            ],
            isactive: true,
            root: true,
            icon: '<i class="fas fa-cog"></i>',
            title: {
                "vi-VN": "Quản trị hệ thống",
                "en-US": "System management",
            },
        },
        // {
        //     ordernumber: 2,
        //     items: [
        //         {
        //             ordernumber: 1,
        //             key: "LaborContract",
        //             type: "component",
        //             isactive: true,
        //             id: "system1590369546382",
        //             icon: '<i class="fas fa-id-card"></i>',
        //             title: {
        //                 "vi-VN": "Hợp đồng lao động",
        //                 "en-US": "Labor contract",
        //             },
        //             url: "",
        //         },
        //         {
        //             ordernumber: 2,
        //             key: "EmployeeList",
        //             type: "component",
        //             isactive: true,
        //             id: "system1590369550360",
        //             icon: '<i class="fas fa-user"></i>',
        //             title: {
        //                 "vi-VN": "Nhân sự",
        //                 "en-US": "Employee",
        //             },
        //             url: "",
        //         },
        //     ],
        //     isactive: true,
        //     icon: '<i class="fas fa-male"></i>',
        //     title: {
        //         "vi-VN": "Hồ sơ nhân sự",
        //         "en-US": "HRM",
        //     },
        // },
        {
            ordernumber: 3,
            items: [
                {
                    ordernumber: 3,
                    title: {
                        "vi-VN": "Tài liệu",
                        "en-US": "Document",
                    },
                    key: "Documentv2",
                    type: "component",
                    isactive: true,
                    id: "sonbm1727358433058",
                },
                // {
                //     ordernumber: 4,
                //     title: {
                //         "vi-VN": "Hợp đồng",
                //         "en-US": "Contract",
                //     },
                //     key: "Workflowv2",
                //     type: "component",
                //     isactive: true,
                //     id: "sonbm1727746229602",
                // },
                {
                    ordernumber: 3,
                    url: "https://e-doc-api.eranin.com",
                    type: "url",
                    isactive: true,
                    id: "admin21741069482562",
                    title: {
                      "vi-VN": "Tài liệu kết nối",
                      "en-US": "API document"
                    }
                },
                {
                    ordernumber: 2,
                    title: {
                      "vi-VN": "Yêu cầu hỗ trợ",
                      "en-US": "Request support"
                    },
                    key: "RequestSupport",
                    type: "component",
                    isactive: true,
                    id: "admin21741069405908"
                },
            ],
            isactive: true,
            icon: '<i class="fab fa-diaspora"></i>',
            title: {
                "vi-VN": "Tiện ích",
                "en-US": "Popular features",
            },
        },
        // {
        //     ordernumber: 4,
        //     items: [
        //         {
        //             ordernumber: 1,
        //             title: {
        //                 "vi-VN": "Yêu cầu hỗ trợ",
        //                 "en-US": "Request support",
        //             },
        //             key: "RequestSupport",
        //             type: "component",
        //             isactive: true,
        //             id: "sonbm1727358433058",
        //         },
        //     ],
        //     isactive: true,
        //     icon: '<i class="fab fa-diaspora"></i>',
        //     title: {
        //         "vi-VN": "Hỗ trợ",
        //         "en-US": "Help",
        //     },
        // },
    ],
};
