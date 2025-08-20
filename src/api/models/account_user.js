/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'account_user',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            password: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            last_login: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            is_superuser: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            username: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            is_staff: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            date_joined: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.fn('NOW'),
            },
            first_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            last_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            has_verified_email: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            institution: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            department: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            participate_in_study: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            subscribe_to_newsletter: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            aware_channel_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_awarechannel',
                    key: 'id',
                },
            },
            ethnicity_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_ethnicity',
                    key: 'id',
                },
            },
            funding_agency_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_fundingagency',
                    key: 'id',
                },
            },
            gender_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_gender',
                    key: 'id',
                },
            },
            occupation_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_occupation',
                    key: 'id',
                },
            },
            region_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_region',
                    key: 'id',
                },
            },
            research_area_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_researcharea',
                    key: 'id',
                },
            },
            orcid_id: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            user_institution_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'account_institution',
                    key: 'id',
                },
            },
            grid_institution_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'account_institution_grid',
                    key: 'id',
                },
            },
            settings: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'account_user',
        }
    )
}
